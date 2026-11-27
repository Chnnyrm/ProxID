"""Category business rules: read and manage the vocabulary the marketplace shares."""

from __future__ import annotations

import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.errors import ConflictError, ValidationError
from ..crud import category as category_crud
from ..models.category import Category
from ..models.user import User
from ..schemas.category import CategoryCreate, CategoryOut


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


class CategoryService:
    """Reads and creates categories."""

    async def list_categories(self, db: AsyncSession) -> list[CategoryOut]:
        """Every category, alphabetically.

        A bounded lookup table, so no pagination. The service exists rather than the
        router reading the crud layer, so the transport layer keeps its one job.
        """
        categories = await category_crud.list_all(db)
        return [CategoryOut.model_validate(category) for category in categories]

    async def create_category(
        self,
        db: AsyncSession,
        name_or_payload: str | CategoryCreate,
        user_id: uuid.UUID | None = None,
        actor: User | None = None,
        description: str | None = None,
    ) -> CategoryOut:
        """Create a new marketplace category with uniqueness and slug rules."""
        if isinstance(name_or_payload, CategoryCreate):
            name = name_or_payload.name
            desc = name_or_payload.description
        else:
            name = name_or_payload
            desc = description

        creator_id = actor.id if actor else user_id

        clean_name = (name or "").strip()
        if not clean_name:
            raise ValidationError(
                "create_category refused: whitespace-only or empty name",
                operation="create_category",
                external_message="Provide a valid category name.",
            )

        existing = await category_crud.get_by_name(db, clean_name)
        if existing is not None:
            raise ConflictError(
                f"create_category conflict: category '{clean_name}' already exists (id={existing.id})",
                operation="create_category",
                external_message=f"Category '{existing.name}' already exists.",
            )

        slug = slugify(clean_name)
        if not slug:
            slug = f"cat-{uuid.uuid4().hex[:8]}"

        existing_slug = await category_crud.get_by_slug(db, slug)
        if existing_slug is not None:
            slug = f"{slug}-{uuid.uuid4().hex[:6]}"

        category = await category_crud.create(
            db,
            name=clean_name,
            slug=slug,
            description=desc,
            created_by_id=creator_id,
        )
        return CategoryOut.model_validate(category)
