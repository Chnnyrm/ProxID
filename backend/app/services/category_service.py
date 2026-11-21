"""Category business rules: read the vocabulary the marketplace shares."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import category as category_crud
from ..schemas.category import CategoryOut


class CategoryService:
    """Reads categories."""

    async def list_categories(self, db: AsyncSession) -> list[CategoryOut]:
        """Every category, alphabetically.

        A bounded lookup table, so no pagination. The service exists rather than the
        router reading the crud layer, so the transport layer keeps its one job.
        """
        categories = await category_crud.list_all(db)
        return [CategoryOut.model_validate(category) for category in categories]
