"""Persistence for categories."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.category import Category


async def list_all(db: AsyncSession) -> list[Category]:
    """Every category, alphabetically. A bounded table, so no pagination."""
    result = await db.execute(select(Category).order_by(Category.name.asc()))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, category_id: uuid.UUID) -> Category | None:
    """One category by id, or None."""
    result = await db.execute(select(Category).where(Category.id == category_id))
    return result.scalar_one_or_none()


async def get_by_slug(db: AsyncSession, slug: str) -> Category | None:
    """One category by its stable slug, or None."""
    if not slug:
        return None
    result = await db.execute(select(Category).where(Category.slug == slug.strip().lower()))
    return result.scalar_one_or_none()


async def names_by_ids(
    db: AsyncSession, category_ids: list[uuid.UUID]
) -> dict[uuid.UUID, str]:
    """Category names for a batch of ids in one query.

    Batched so a list of twenty listings is not twenty-one queries.
    """
    wanted = [category_id for category_id in category_ids if category_id is not None]
    if not wanted:
        return {}
    result = await db.execute(select(Category.id, Category.name).where(Category.id.in_(wanted)))
    return {category_id: name for category_id, name in result.all()}


async def create(
    db: AsyncSession, *, name: str, slug: str, description: str | None = None
) -> Category:
    """Insert one category and flush."""
    category = Category(name=name.strip(), slug=slug.strip().lower(), description=description)
    db.add(category)
    await db.flush()
    return category
