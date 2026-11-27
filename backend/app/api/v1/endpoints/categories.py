"""Category routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....schemas.category import CategoryCreate, CategoryOut
from ...deps import CurrentUser, get_container, get_current_user, get_db

router = APIRouter()


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> list[CategoryOut]:
    """Every category, for a picker or a filter."""
    return await container.categories.list_categories(db)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> CategoryOut:
    """Create a new marketplace category for authenticated users."""
    return await container.categories.create_category(
        db, payload, actor=current_user
    )
