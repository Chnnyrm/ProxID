"""User business rules: profile changes, provider cards, and who may see what.

The important rule in this file is that verification is read, never written, from
a request. A badge is granted by the identity service after a proof exists and by
nothing else.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.errors import AuthorizationError, NotFoundError, ValidationError
from ..crud import category as category_crud
from ..crud import job as job_crud
from ..crud import service as service_crud
from ..crud import user as user_crud
from ..models.user import User
from ..schemas.user import MeOut, ProviderOut, ProviderServiceOut, UserOut, UserUpdate

#: Radius used when a provider card is built from a coordinate. Ten kilometres is
#: "my neighbourhood" for a hyper-local marketplace.
NEIGHBOURHOOD_RADIUS_KM = 10.0


@dataclass(frozen=True)
class RatingSummary:
    """The star-rating facts a provider card shows."""

    average: float | None
    count: int


def to_user_out(user: User) -> UserOut:
    """The public shape of a person."""
    return UserOut(
        id=user.id,
        display_name=user.display_name,
        role=user.role,
        avatar_url=user.avatar_url,
        bio=user.bio,
        neighbourhood=user.neighbourhood,
        concordium_verified=user.concordium_verified,
        cis8004_agent_id=user.cis8004_agent_id,
        is_demo=user.is_demo,
        created_at=user.created_at,
    )


def to_me_out(user: User) -> MeOut:
    """The signed-in person's own shape, including what only they may see."""
    return MeOut(
        id=user.id,
        display_name=user.display_name,
        role=user.role,
        avatar_url=user.avatar_url,
        bio=user.bio,
        neighbourhood=user.neighbourhood,
        concordium_verified=user.concordium_verified,
        cis8004_agent_id=user.cis8004_agent_id,
        is_demo=user.is_demo,
        created_at=user.created_at,
        email=user.email,
        concordium_account_address=user.concordium_account_address,
        latitude=user.latitude,
        longitude=user.longitude,
    )


class UserService:
    """Reads and writes one person, and enforces object-level access to them."""

    async def get_or_raise(self, db: AsyncSession, user_id: uuid.UUID) -> User:
        """One user, or a NotFoundError that reveals nothing about existence."""
        user = await user_crud.get_by_id(db, user_id)
        if user is None:
            raise NotFoundError(
                f"get_user failed: user_id={user_id} not found (layer=crud)",
                operation="get_user",
                external_message="We could not find that profile. It may have been removed.",
            )
        return user

    async def update_profile(
        self, db: AsyncSession, user: User, payload: UserUpdate
    ) -> User:
        """Apply the fields the person actually sent.

        A coordinate pair is written as a point and as floats together, and a lone
        coordinate is rejected: a half-updated position would rank the person in
        the wrong place.
        """
        if (payload.latitude is None) != (payload.longitude is None):
            raise ValidationError(
                f"update_profile refused: partial coordinates latitude={payload.latitude} "
                f"longitude={payload.longitude} (layer=service)",
                operation="update_profile",
                external_message="Send both a latitude and a longitude, or neither, so we can place you correctly.",
            )

        if payload.latitude is not None and payload.longitude is not None:
            await user_crud.update_location(db, user, payload.latitude, payload.longitude)

        for field, value in payload.model_dump(exclude_unset=True).items():
            if field in ("latitude", "longitude"):
                continue
            if value is not None:
                setattr(user, field, value)
        await db.flush()
        return user

    def require_self(self, actor: User, subject_id: uuid.UUID) -> None:
        """Deny access to anyone else's private profile."""
        if actor.id != subject_id:
            raise AuthorizationError(
                f"read_private_profile denied: actor={actor.id} subject={subject_id} (layer=service)",
                operation="read_private_profile",
                external_message="You can only view your own account details.",
            )

    async def build_provider_cards(
        self,
        db: AsyncSession,
        providers: list[tuple[User, float]],
        *,
        include_services: bool = True,
    ) -> list[ProviderOut]:
        """Turn ``(user, distance_metres)`` pairs into provider cards.

        Listings are fetched one provider at a time on purpose: the number of
        providers on a page is bounded, each fetch is a small indexed query, and
        the alternative is a join whose pagination would duplicate provider rows.
        """
        cards: list[ProviderOut] = []
        for provider, distance_metres in providers:
            listings = (
                await service_crud.list_by_provider(db, provider.id, limit=5)
                if include_services
                else []
            )
            category_ids = [
                listing.category_id for listing in listings if listing.category_id is not None
            ]
            names = await category_crud.names_by_ids(db, category_ids)
            completed = await job_crud.count_completed_for_provider(db, provider.id)
            cards.append(
                ProviderOut(
                    **to_user_out(provider).model_dump(),
                    distance_km=round(distance_metres / 1000.0, 2),
                    completed_jobs=completed,
                    average_rating=None,
                    rating_count=0,
                    services=[
                        ProviderServiceOut(
                            id=listing.id,
                            title=listing.title,
                            price=float(listing.price),
                            category_name=names.get(listing.category_id)
                            if listing.category_id
                            else None,
                            image_url=listing.image_url,
                        )
                        for listing in listings
                    ],
                )
            )
        return cards

    async def list_nearby_providers(
        self,
        db: AsyncSession,
        *,
        latitude: float,
        longitude: float,
        radius_km: float,
        verified_only: bool,
        limit: int,
        offset: int,
    ) -> list[ProviderOut]:
        """Providers around a point, nearest first, verified ones included honestly."""
        providers = await user_crud.list_providers_near(
            db,
            latitude,
            longitude,
            radius_km,
            require_verified=verified_only,
            limit=limit,
            offset=offset,
        )
        return await self.build_provider_cards(db, providers)

    async def search_providers(
        self, db: AsyncSession, query: str, *, limit: int, offset: int
    ) -> list[ProviderOut]:
        """Providers matching a free-text query, most relevant first."""
        providers = await user_crud.list_providers_by_text(db, query, limit=limit, offset=offset)
        return await self.build_provider_cards(db, [(user, 0.0) for user in providers])


def money(value: Decimal | float | int | None) -> float:
    """A money column as the float the wire format carries.

    The database stores an exact Decimal; the transport speaks a number. The
    conversion happens once, here, rather than in every caller.
    """
    return float(value) if value is not None else 0.0
