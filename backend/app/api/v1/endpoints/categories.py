"""Category routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....schemas.category import CategoryOut
from ...deps import get_container, get_db

router = APIRouter()


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> list[CategoryOut]:
    """Every category, for a picker or a filter."""
    return await container.categories.list_categories(db)
