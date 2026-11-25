"""Job routes: posting, discovery, the room, and state changes.

The two literal paths under ``/search`` are declared before ``/{job_id}`` so
"search" is never parsed as an id.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....schemas.application import ApplicationCreate, ApplicationOut
from ....schemas.job import JobCreate, JobOut, JobRoomOut, JobStatusUpdate
from ...deps import CurrentUser, get_container, get_current_user, get_db, get_optional_user

router = APIRouter()


@router.get("/search/nearby", response_model=list[JobOut])
async def search_nearby(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=5, ge=0, le=100),
    category_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser | None = Depends(get_optional_user),
) -> list[JobOut]:
    """Open jobs around a point, nearest first.

    The caller's own jobs are excluded, because they belong under "my jobs". A
    signed-out visitor sees everything.
    """
    return await container.jobs.list_open_nearby(
        db,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        exclude_user_id=current_user.id if current_user else None,
        category_id=category_id,
        limit=limit,
        offset=offset,
        actor=current_user,
    )


@router.get("/search", response_model=list[JobOut])
async def search(
    q: str | None = Query(default=None, max_length=120),
    status_filter: str | None = Query(default="open", alias="status", max_length=120),
    category_id: uuid.UUID | None = Query(default=None),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float = Query(default=10, ge=0, le=100),
    sort: str | None = Query(default=None, pattern="^(price_asc|price_desc|newest|nearest)$"),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser | None = Depends(get_optional_user),
) -> list[JobOut]:
    """The general job search behind the filters in the interface."""
    return await container.jobs.search(
        db,
        status=status_filter,
        category_id=category_id,
        search_text=q,
        min_price=min_price,
        max_price=max_price,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        sort_by=sort,
        limit=limit,
        offset=offset,
        actor=current_user,
    )


@router.get("/mine", response_model=list[JobOut])
async def my_jobs(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[JobOut]:
    """Jobs the caller posted and jobs they were hired for."""
    return await container.jobs.list_mine(db, current_user, limit=50, offset=0)


@router.get("/applied-ids", response_model=list[uuid.UUID])
async def my_applied_job_ids(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[uuid.UUID]:
    """Job IDs that the signed-in user has already applied to."""
    return await container.jobs.get_applied_job_ids(db, current_user)


@router.get("", response_model=list[JobOut])
async def browse(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser | None = Depends(get_optional_user),
) -> list[JobOut]:
    """The open-jobs list, ranked by freshness blended with activity."""
    return await container.jobs.browse(db, limit=limit, offset=offset, actor=current_user)


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def post_job(
    payload: JobCreate,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> JobOut:
    """Post a job for nearby providers to find."""
    return await container.jobs.post_job(db, current_user, payload)


@router.post("/{job_id}/apply", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def apply_to_job(
    job_id: uuid.UUID,
    payload: ApplicationCreate | None = None,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApplicationOut:
    """Apply to an open job."""
    msg = payload.message if payload else None
    price = payload.proposed_price if payload else None
    return await container.jobs.apply_to_job(
        db,
        current_user,
        job_id,
        message=msg,
        proposed_price=price,
    )


@router.get("/{job_id}", response_model=JobOut)
async def read_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser | None = Depends(get_optional_user),
) -> JobOut:
    """One job."""
    return await container.jobs.get_job(db, job_id, actor=current_user)


@router.get("/{job_id}/room", response_model=JobRoomOut)
async def read_room(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> JobRoomOut:
    """The job room: job, participants, thread and payment state."""
    return await container.jobs.get_room(db, current_user, job_id)


@router.patch("/{job_id}/status", response_model=JobOut)
async def change_status(
    job_id: uuid.UUID,
    payload: JobStatusUpdate,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> JobOut:
    """Ask for a state transition. The service decides whether it is legal."""
    return await container.jobs.change_status(
        db,
        current_user,
        job_id,
        to_status=payload.status,
        provider_id=payload.provider_id,
    )
