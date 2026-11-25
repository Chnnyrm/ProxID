"""Persistence for the user entity.

The geographic queries here are ported from Gigr's ``crud/user.py`` and keep the
same PostGIS semantics:

- ``ST_DWithin`` on the geography column takes a radius in metres, so a radius in
  kilometres is multiplied by 1000 at the call site.
- ``ST_DistanceSphere`` measures a spheroid distance in metres between two
  geometry points, which is what a provider's distance to a job needs.

Both return metres. Nothing in this file converts to kilometres; that happens once
at the service boundary so the two callers cannot disagree.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.geo import geography_point, geometry_point, to_wkt_point
from ..core.text_search import tokenize_query
from ..models.user import User

#: How far a verified provider may appear from where they actually are, for
#: ranking only. Ported from Gigr's vouch distance boost: a proven provider
#: surfaces above an unproven one at a similar range. The distance returned to
#: the client is always the true one.
VERIFIED_DISTANCE_BOOST_METRES = 3000.0


async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    """One user by id, or None."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    """One user by email, compared case-insensitively after normalisation."""
    normalised = (email or "").strip().lower()
    if not normalised:
        return None
    result = await db.execute(select(User).where(func.lower(User.email) == normalised))
    return result.scalar_one_or_none()


async def get_by_google_id(db: AsyncSession, google_id: str) -> User | None:
    """One user by their Google subject id, or None."""
    if not google_id:
        return None
    result = await db.execute(select(User).where(User.google_id == google_id))
    return result.scalar_one_or_none()


async def get_by_username(db: AsyncSession, username: str) -> User | None:
    """One user by username, compared case-insensitively after normalisation."""
    normalised = (username or "").strip().lower()
    if not normalised:
        return None
    result = await db.execute(select(User).where(func.lower(User.username) == normalised))
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    email: str,
    display_name: str,
    hashed_password: str | None = None,
    google_id: str | None = None,
    role: str = "both",
    avatar_url: str | None = None,
    is_demo: bool = False,
) -> User:
    """Insert one user and flush. The caller owns the transaction."""
    user = User(
        email=email.strip().lower(),
        display_name=display_name.strip(),
        hashed_password=hashed_password,
        google_id=google_id,
        role=role,
        avatar_url=avatar_url,
        is_demo=is_demo,
    )
    db.add(user)
    await db.flush()
    return user


async def update_location(
    db: AsyncSession, user: User, latitude: float, longitude: float
) -> User:
    """Store a coordinate as a point and as floats.

    Both representations are written together so a query never has to fall back to
    one of them being stale.
    """
    user.latitude = float(latitude)
    user.longitude = float(longitude)
    user.last_location = to_wkt_point(latitude, longitude)
    user.last_seen_at = datetime.now(timezone.utc)
    await db.flush()
    return user


async def list_providers_near(
    db: AsyncSession,
    latitude: float,
    longitude: float,
    radius_km: float,
    *,
    require_verified: bool = False,
    limit: int = 20,
    offset: int = 0,
) -> list[tuple[User, float]]:
    """Providers within ``radius_km`` of a point, nearest first.

    Returns ``(user, distance_metres)`` pairs. Only users who offer something are
    included, which is why the query filters on role rather than on the presence
    of a listing: a provider whose listings are paused is still a provider, and
    the listing join belongs to the listing query.

    ``radius_km <= 0`` means no radius limit, the same convention the service
    listing search uses.
    """
    point = geography_point(longitude, latitude)
    # Two measures, both in metres: ST_DWithin filters on geography, and
    # ST_DistanceSphere gives the spheroid distance on geometry, which is the same
    # measure Gigr used for provider-to-job matching.
    distance = func.ST_DistanceSphere(
        cast(User.last_location, Geometry), geometry_point(longitude, latitude)
    ).label("distance_m")

    conditions = [
        User.is_active.is_(True),
        User.last_location.isnot(None),
        User.role.in_(("provider", "both")),
    ]
    if radius_km and radius_km > 0:
        conditions.append(func.ST_DWithin(User.last_location, point, radius_km * 1000))
    if require_verified:
        conditions.append(User.concordium_verified.is_(True))

    query = (
        select(User, distance)
        .where(*conditions)
        .order_by(distance.asc(), User.id.asc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(query)).all()
    return [(user, float(distance_m or 0.0)) for user, distance_m in rows]


async def list_providers_by_text(
    db: AsyncSession, query_text: str, *, limit: int = 20, offset: int = 0
) -> list[User]:
    """Providers whose display name or bio matches any significant query word.

    Relevance is counted by the database (one CASE per token, summed) rather than
    by fetching every match and sorting in Python, so pagination stays correct and
    this stays one query.
    """
    tokens = tokenize_query(query_text)[:8]
    if tokens:
        conditions = []
        relevance = None
        for token in tokens:
            pattern = f"%{token}%"
            conditions.extend(
                [User.display_name.ilike(pattern), User.bio.ilike(pattern)]
            )
            contribution = case((User.display_name.ilike(pattern), 1), else_=0) + case(
                (User.bio.ilike(pattern), 1), else_=0
            )
            relevance = contribution if relevance is None else relevance + contribution
    else:
        # Nothing meaningful survived tokenisation, so match the phrase as typed.
        pattern = f"%{query_text}%"
        conditions = [User.display_name.ilike(pattern), User.bio.ilike(pattern)]
        relevance = case((User.display_name.ilike(pattern), 1), else_=0)

    query = (
        select(User)
        .where(or_(*conditions), User.is_active.is_(True))
        .order_by(relevance.desc(), User.display_name.asc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.execute(query)).scalars().all())


async def set_concordium_verification(
    db: AsyncSession,
    user: User,
    *,
    account_address: str | None,
    proof_reference: str,
) -> User:
    """Record a verified-human proof reference on a user.

    Called by the identity service once a real proof exists. It is never called
    while the integration is unconfigured, and it refuses an empty reference so a
    badge cannot be granted by accident.
    """
    if not proof_reference:
        raise ValueError("verification requires a proof reference; a badge with nothing behind it is not a badge")
    if account_address:
        user.concordium_account_address = account_address
    user.concordium_zk_proof_ref = proof_reference
    user.concordium_verified = True
    user.verified_at = datetime.now(timezone.utc)
    await db.flush()
    return user


async def get_many_by_ids(
    db: AsyncSession, user_ids: list[uuid.UUID]
) -> dict[uuid.UUID, User]:
    """A batch of users by id, in one query.

    Exists so a list of listings can show provider names without one query per
    listing.
    """
    wanted = [user_id for user_id in user_ids if user_id is not None]
    if not wanted:
        return {}
    result = await db.execute(select(User).where(User.id.in_(wanted)))
    return {user.id: user for user in result.scalars().all()}
