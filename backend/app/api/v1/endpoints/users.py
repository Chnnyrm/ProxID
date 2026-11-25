"""Profile and provider discovery routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....schemas.user import MeOut, ProviderOut, PublicProfileOut, UserOut, UserUpdate
from ...deps import CurrentUser, get_container, get_current_user, get_db

router = APIRouter()


@router.get("/me", response_model=MeOut)
async def read_me(
    current_user: CurrentUser = Depends(get_current_user),
    container: Container = Depends(get_container),
) -> MeOut:
    """The signed-in person's own profile."""
    from ....services.user_service import to_me_out

    return to_me_out(current_user)


@router.patch("/me", response_model=MeOut)
async def update_me(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> MeOut:
    """Update the signed-in person's own profile."""
    from ....services.user_service import to_me_out

    updated = await container.users.update_profile(db, current_user, payload)
    return to_me_out(updated)


@router.get("/providers/nearby", response_model=list[ProviderOut])
async def providers_nearby(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=5, ge=0, le=100),
    verified_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> list[ProviderOut]:
    """Providers around a point, nearest first.

    A radius of zero means no radius limit, which is what the map uses to draw
    everything inside the visible area.
    """
    return await container.users.list_nearby_providers(
        db,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        verified_only=verified_only,
        limit=limit,
        offset=offset,
    )


@router.get("/providers/search", response_model=list[ProviderOut])
async def providers_search(
    q: str = Query(min_length=1, max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> list[ProviderOut]:
    """Providers matching a word, for someone who has not shared a location."""
    return await container.users.search_providers(db, q, limit=limit, offset=offset)


@router.get("/u/{username}", response_model=PublicProfileOut)
async def read_public_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> PublicProfileOut:
    """A person's public shareable portfolio profile reachable without authentication."""
    return await container.users.get_public_profile(db, username)


@router.get("/{user_id}", response_model=UserOut)
async def read_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> UserOut:
    """Another person's public profile."""
    from ....services.user_service import to_user_out

    user = await container.users.get_or_raise(db, user_id)
    return to_user_out(user)
