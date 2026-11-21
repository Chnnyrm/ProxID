"""Service listing routes.

Order matters: the two literal search paths are declared before the id path, so
"search" is never parsed as a listing id.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....schemas.service import ServiceCreate, ServiceOut, ServiceUpdate
from ...deps import CurrentUser, get_container, get_current_user, get_db

router = APIRouter()


@router.get("/search/nearby", response_model=list[ServiceOut])
async def search_nearby(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=5, ge=0, le=100),
    category_id: uuid.UUID | None = Query(default=None),
    verified_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> list[ServiceOut]:
    """Listings around a point, nearest first. Radius zero means no limit."""
    return await container.listings.list_nearby(
        db,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        category_id=category_id,
        verified_only=verified_only,
        limit=limit,
        offset=offset,
    )


@router.get("/search/text", response_model=list[ServiceOut])
async def search_text(
    q: str = Query(min_length=1, max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> list[ServiceOut]:
    """Listings matching a word or phrase, most matches first."""
    return await container.listings.search(db, q, limit=limit, offset=offset)


@router.get("/mine", response_model=list[ServiceOut])
async def my_listings(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[ServiceOut]:
    """The signed-in provider's own listings."""
    return await container.listings.list_mine(db, current_user, limit=50, offset=0)


@router.get("/{service_id}", response_model=ServiceOut)
async def read_listing(
    service_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> ServiceOut:
    """One listing."""
    return await container.listings.get_listing(db, service_id)


@router.post("", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
async def create_listing(
    payload: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> ServiceOut:
    """Publish a listing. Only a provider account may."""
    return await container.listings.create_listing(db, current_user, payload)


@router.patch("/{service_id}", response_model=ServiceOut)
async def update_listing(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> ServiceOut:
    """Change a listing the caller owns."""
    return await container.listings.update_listing(db, current_user, service_id, payload)
