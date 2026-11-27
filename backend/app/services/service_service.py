"""Service listing business rules: publish, pause, and search nearby.

This is where the ported PostGIS metres become the kilometres the interface talks
about, once, so two endpoints cannot round differently.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.errors import AuthorizationError, NotFoundError, ValidationError
from ..core.geo import extract_coordinates
from ..crud import category as category_crud
from ..crud import job as job_crud
from ..crud import service as service_crud
from ..crud import user as user_crud
from ..models.service import ServiceListing
from ..models.user import User
from ..schemas.service import ServiceCreate, ServiceOut, ServiceUpdate

#: Default reach of a listing: a provider will travel five kilometres.
DEFAULT_RADIUS_KM = 5.0


def to_service_out(
    listing: ServiceListing,
    *,
    distance_metres: float | None = None,
    provider: User | None = None,
    category_name: str | None = None,
    provider_completed_jobs: int = 0,
    provider_vouches_count: int = 0,
    provider_average_rating: float | None = None,
    provider_other_listings: list[ServiceOut] | None = None,
) -> ServiceOut:
    """Map a listing to its wire shape.

    The stored geometry is the source of truth for the coordinate; the plain
    floats on the row are a convenience and may lag a write, so they are not read
    here.
    """
    latitude, longitude = extract_coordinates(listing.location)
    listing_urls = getattr(listing, "image_urls", None)
    urls = list(listing_urls) if listing_urls else ([listing.image_url] if listing.image_url else [])
    cover = listing.image_url or (urls[0] if urls else None)
    return ServiceOut(
        id=listing.id,
        provider_id=listing.provider_id,
        category_id=listing.category_id,
        category_name=category_name,
        title=listing.title,
        description=listing.description,
        price=float(listing.price),
        min_price=float(listing.min_price) if listing.min_price is not None else None,
        max_price=float(listing.max_price) if listing.max_price is not None else None,
        currency=listing.currency,
        latitude=latitude,
        longitude=longitude,
        radius_km=float(listing.radius_km),
        image_url=cover,
        image_urls=urls,
        is_active=listing.is_active,
        distance_km=round(distance_metres / 1000.0, 2) if distance_metres is not None else None,
        provider_display_name=provider.display_name if provider else None,
        provider_avatar_url=provider.avatar_url if provider else None,
        provider_username=provider.username if provider else None,
        provider_concordium_verified=provider.concordium_verified if provider else False,
        provider_completed_jobs=provider_completed_jobs,
        provider_vouches_count=provider_vouches_count,
        provider_average_rating=provider_average_rating,
        provider_other_listings=provider_other_listings or [],
        is_demo=listing.is_demo,
        created_at=listing.created_at,
    )


class ServiceListingService:
    """The use cases around what a provider offers."""

    def require_provider_role(self, actor: User) -> None:
        """Only someone who offers work may publish a listing."""
        if actor.role not in ("provider", "both"):
            raise AuthorizationError(
                f"create_listing denied: actor={actor.id} role={actor.role} is not a provider (layer=service)",
                operation="create_listing",
                external_message="Switch your account to offering services before publishing a listing.",
            )

    async def create_listing(
        self, db: AsyncSession, actor: User, payload: ServiceCreate
    ) -> ServiceOut:
        """Publish a listing at the provider's own coordinate."""
        self.require_provider_role(actor)
        if payload.category_id is not None:
            category = await category_crud.get_by_id(db, payload.category_id)
            if category is None:
                raise ValidationError(
                    f"create_listing refused: category_id={payload.category_id} does not exist (layer=crud)",
                    operation="create_listing",
                    external_message="Pick a category from the list. That one no longer exists.",
                )
        effective_price = payload.price if payload.price is not None else (payload.min_price or 0.0)
        urls = list(payload.image_urls) if payload.image_urls else ([payload.image_url] if payload.image_url else [])
        cover = payload.image_url or (urls[0] if urls else None)
        listing = await service_crud.create(
            db,
            provider_id=actor.id,
            title=payload.title,
            description=payload.description,
            price=effective_price,
            min_price=payload.min_price,
            max_price=payload.max_price,
            category_id=payload.category_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            radius_km=payload.radius_km or DEFAULT_RADIUS_KM,
            image_url=cover,
            image_urls=urls,
        )
        category_names = await category_crud.names_by_ids(
            db, [payload.category_id] if payload.category_id else []
        )
        return to_service_out(
            listing,
            provider=actor,
            category_name=category_names.get(payload.category_id) if payload.category_id else None,
        )

    async def update_listing(
        self, db: AsyncSession, actor: User, listing_id: uuid.UUID, payload: ServiceUpdate
    ) -> ServiceOut:
        """Change a listing the caller owns."""
        listing = await self._owned_listing(db, actor, listing_id, operation="update_listing")
        fields = payload.model_dump(exclude_unset=True)
        updated = await service_crud.update(db, listing, **fields)
        category_name = None
        if updated.category_id is not None:
            names = await category_crud.names_by_ids(db, [updated.category_id])
            category_name = names.get(updated.category_id)
        return to_service_out(updated, provider=actor, category_name=category_name)

    async def set_listing_active(
        self, db: AsyncSession, actor: User, listing_id: uuid.UUID, is_active: bool
    ) -> ServiceOut:
        """Pause or resume a listing the caller owns."""
        listing = await self._owned_listing(db, actor, listing_id, operation="set_listing_active")
        updated = await service_crud.set_active(db, listing, is_active)
        return to_service_out(updated, provider=actor)

    async def list_nearby(
        self,
        db: AsyncSession,
        *,
        latitude: float,
        longitude: float,
        radius_km: float,
        category_id: uuid.UUID | None,
        verified_only: bool,
        limit: int,
        offset: int,
    ) -> list[ServiceOut]:
        """Listings around a point, nearest first.

        The distance is the true distance. Provider ordering may have been nudged
        by the verified boost, but the number shown to the client is never boosted.
        """
        rows = await service_crud.list_nearby(
            db,
            latitude,
            longitude,
            radius_km,
            category_id=category_id,
            verified_only=verified_only,
            limit=limit,
            offset=offset,
        )
        providers = await user_crud.get_many_by_ids(db, [listing.provider_id for listing, _, _ in rows])
        category_names = await category_crud.names_by_ids(
            db, [listing.category_id for listing, _, _ in rows if listing.category_id is not None]
        )
        return [
            to_service_out(
                listing,
                distance_metres=distance_metres,
                provider=providers.get(listing.provider_id),
                category_name=category_names.get(listing.category_id)
                if listing.category_id
                else None,
            )
            for listing, distance_metres, _verified in rows
        ]

    async def search(
        self, db: AsyncSession, query: str, *, limit: int, offset: int
    ) -> list[ServiceOut]:
        """Free-text search across titles and descriptions."""
        listings = await service_crud.list_by_text(db, query, limit=limit, offset=offset)
        providers = await user_crud.get_many_by_ids(db, [listing.provider_id for listing in listings])
        category_names = await category_crud.names_by_ids(
            db, [listing.category_id for listing in listings if listing.category_id is not None]
        )
        return [
            to_service_out(
                listing,
                provider=providers.get(listing.provider_id),
                category_name=category_names.get(listing.category_id)
                if listing.category_id
                else None,
            )
            for listing in listings
        ]

    async def list_mine(
        self, db: AsyncSession, actor: User, *, limit: int, offset: int
    ) -> list[ServiceOut]:
        """The provider's own active listings, newest first."""
        listings = await service_crud.list_by_provider(db, actor.id, limit=limit, offset=offset)
        category_names = await category_crud.names_by_ids(
            db, [listing.category_id for listing in listings if listing.category_id is not None]
        )
        return [
            to_service_out(
                listing,
                provider=actor,
                category_name=category_names.get(listing.category_id)
                if listing.category_id
                else None,
            )
            for listing in listings
        ]

    async def get_listing(self, db: AsyncSession, listing_id: uuid.UUID) -> ServiceOut:
        """One listing, or a not-found that does not distinguish missing from hidden."""
        listing = await service_crud.get_by_id(db, listing_id)
        if listing is None:
            raise NotFoundError(
                f"get_listing failed: service_id={listing_id} not found (layer=crud)",
                operation="get_listing",
                external_message="We could not find that listing. It may have been removed.",
            )
        provider = await user_crud.get_by_id(db, listing.provider_id)
        category_name = None
        if listing.category_id is not None:
            names = await category_crud.names_by_ids(db, [listing.category_id])
            category_name = names.get(listing.category_id)

        completed = await job_crud.count_completed_for_provider(db, listing.provider_id)
        vouches = completed if (provider and provider.concordium_verified) else 0

        # Provider's other listings
        raw_other = await service_crud.list_by_provider(db, listing.provider_id, limit=6)
        other_cats = await category_crud.names_by_ids(
            db, [l.category_id for l in raw_other if l.category_id is not None]
        )
        other_listings = [
            to_service_out(
                l,
                provider=provider,
                category_name=other_cats.get(l.category_id),
            )
            for l in raw_other
            if l.id != listing.id
        ]

        return to_service_out(
            listing,
            provider=provider,
            category_name=category_name,
            provider_completed_jobs=completed,
            provider_vouches_count=vouches,
            provider_other_listings=other_listings,
        )

    async def _owned_listing(
        self, db: AsyncSession, actor: User, listing_id: uuid.UUID, *, operation: str
    ) -> ServiceListing:
        """One listing, if the caller owns it. Authorization lives here, not in the router."""
        listing = await service_crud.get_by_id(db, listing_id)
        if listing is None:
            raise NotFoundError(
                f"{operation} failed: service_id={listing_id} not found (layer=crud)",
                operation=operation,
                external_message="We could not find that listing. It may have been removed.",
            )
        if listing.provider_id != actor.id:
            raise AuthorizationError(
                f"{operation} denied: actor={actor.id} is not the owner of service_id={listing_id} (layer=service)",
                operation=operation,
                external_message="That listing belongs to someone else, so you cannot change it.",
            )
        return listing
