"""Persistence for service listings, including the nearby search that is the
heart of the product.

Ported from Gigr's ``crud/service.py`` with the PostGIS semantics unchanged:

- ``ST_DWithin(listing.location, point, radius_km * 1000)`` filters on the
  geography column, so the radius is metres.
- ``ST_Distance(listing.location, point)`` returns metres on geography.

What changed is the ranking signal, not the geometry: Gigr treated a vouched
provider as if they were 3 km closer. ProxID treats a Concordium-verified
provider the same way, because the human proof is this product's trust signal. The
distance reported to the client is always the true distance, never the boosted one.
"""

from __future__ import annotations

import uuid

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.geo import geography_point, to_wkt_point
from ..core.text_search import tokenize_query
from ..models.service import ServiceListing
from ..models.user import User

#: Ranking boost, in metres, for a provider whose human proof is on file.
VERIFIED_DISTANCE_BOOST_METRES = 3000.0


async def get_by_id(db: AsyncSession, service_id: uuid.UUID) -> ServiceListing | None:
    """One listing by id, or None."""
    result = await db.execute(select(ServiceListing).where(ServiceListing.id == service_id))
    return result.scalar_one_or_none()


async def list_by_provider(
    db: AsyncSession, provider_id: uuid.UUID, *, limit: int = 20, offset: int = 0
) -> list[ServiceListing]:
    """One provider's active listings, newest first."""
    result = await db.execute(
        select(ServiceListing)
        .where(
            ServiceListing.provider_id == provider_id,
            ServiceListing.is_active.is_(True),
        )
        .order_by(ServiceListing.created_at.desc(), ServiceListing.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def list_nearby(
    db: AsyncSession,
    latitude: float,
    longitude: float,
    radius_km: float,
    *,
    category_id: uuid.UUID | None = None,
    verified_only: bool = False,
    limit: int = 20,
    offset: int = 0,
) -> list[tuple[ServiceListing, float, bool]]:
    """Active listings within ``radius_km``, nearest first.

    Returns ``(listing, true_distance_metres, is_verified)``. Ordering is done by
    the database on the boosted distance, then by true distance, so a verified
    provider at a similar range comes first while the true distance is still what
    the client shows.

    ``radius_km <= 0`` means no radius limit: the map draws the radius as an
    indicator and shows everything with a coordinate.
    """
    point = geography_point(longitude, latitude)
    distance = func.ST_Distance(ServiceListing.location, point).label("distance_m")
    boosted = (
        func.ST_Distance(ServiceListing.location, point)
        - case((User.concordium_verified.is_(True), VERIFIED_DISTANCE_BOOST_METRES), else_=0.0)
    ).label("rank_m")

    conditions = [
        ServiceListing.is_active.isnot(False),
        ServiceListing.location.isnot(None),
    ]
    if radius_km and radius_km > 0:
        conditions.append(func.ST_DWithin(ServiceListing.location, point, radius_km * 1000))
    if category_id is not None:
        conditions.append(ServiceListing.category_id == category_id)
    if verified_only:
        conditions.append(User.concordium_verified.is_(True))

    query = (
        select(ServiceListing, distance, User.concordium_verified)
        .join(User, User.id == ServiceListing.provider_id)
        .where(*conditions)
        .order_by(boosted.asc(), distance.asc(), ServiceListing.id.asc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(query)).all()
    return [
        (listing, float(distance_m or 0.0), bool(verified))
        for listing, distance_m, verified in rows
    ]


async def list_by_text(
    db: AsyncSession, query_text: str, *, limit: int = 20, offset: int = 0
) -> list[ServiceListing]:
    """Listings matching any significant query word, most matches first.

    Separator-stripped comparison is kept from Gigr: "woodworks" has to match a
    listing titled "Wood Works, Furniture". Relevance is summed in SQL so the
    database can paginate, unlike the original which fetched 3x the page and
    sorted in Python.
    """
    tokens = tokenize_query(query_text)[:8]
    if tokens:
        conditions = []
        relevance = None
        for token in tokens:
            pattern = f"%{token}%"
            compact = func.regexp_replace(func.lower(ServiceListing.title), "[^a-z0-9]", "", "g")
            compact_description = func.regexp_replace(
                func.lower(func.coalesce(ServiceListing.description, "")), "[^a-z0-9]", "", "g"
            )
            stripped = "".join(character for character in token.lower() if character.isalnum())
            conditions.extend(
                [
                    ServiceListing.title.ilike(pattern),
                    ServiceListing.description.ilike(pattern),
                ]
            )
            contribution = case((ServiceListing.title.ilike(pattern), 1), else_=0) + case(
                (ServiceListing.description.ilike(pattern), 1), else_=0
            )
            if stripped:
                conditions.extend(
                    [compact.like(f"%{stripped}%"), compact_description.like(f"%{stripped}%")]
                )
                contribution = contribution + case((compact.like(f"%{stripped}%"), 1), else_=0)
            relevance = contribution if relevance is None else relevance + contribution
    else:
        pattern = f"%{query_text}%"
        conditions = [
            ServiceListing.title.ilike(pattern),
            ServiceListing.description.ilike(pattern),
        ]
        relevance = case((ServiceListing.title.ilike(pattern), 1), else_=0)

    query = (
        select(ServiceListing)
        .where(or_(*conditions), ServiceListing.is_active.isnot(False))
        .order_by(relevance.desc(), ServiceListing.created_at.desc(), ServiceListing.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.execute(query)).scalars().all())


async def create(
    db: AsyncSession,
    *,
    provider_id: uuid.UUID,
    title: str,
    description: str | None,
    price: float,
    min_price: float | None,
    max_price: float | None,
    category_id: uuid.UUID | None,
    latitude: float,
    longitude: float,
    radius_km: float,
    image_url: str | None = None,
    is_demo: bool = False,
) -> ServiceListing:
    """Insert one listing and flush."""
    listing = ServiceListing(
        provider_id=provider_id,
        category_id=category_id,
        title=title.strip(),
        description=description,
        price=price,
        min_price=min_price,
        max_price=max_price,
        location=to_wkt_point(latitude, longitude),
        radius_km=radius_km,
        image_url=image_url,
        is_demo=is_demo,
    )
    db.add(listing)
    await db.flush()
    return listing


async def update(db: AsyncSession, listing: ServiceListing, **fields: object) -> ServiceListing:
    """Apply the fields that were actually sent. Unknown keys are ignored here and
    rejected earlier, at the schema boundary."""
    latitude = fields.pop("latitude", None)
    longitude = fields.pop("longitude", None)
    if latitude is not None and longitude is not None:
        listing.location = to_wkt_point(float(latitude), float(longitude))
    for name, value in fields.items():
        if value is not None and hasattr(listing, name):
            setattr(listing, name, value)
    await db.flush()
    return listing


async def set_active(db: AsyncSession, listing: ServiceListing, is_active: bool) -> ServiceListing:
    """Pause or resume a listing."""
    listing.is_active = is_active
    await db.flush()
    return listing
