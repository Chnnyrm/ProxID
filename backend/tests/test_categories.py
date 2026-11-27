"""Tests for inline category creation and duplicate guards.
Pure ASCII.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.core.errors import ConflictError, ValidationError
from app.models.category import Category
from app.schemas.category import CategoryCreate
from app.services.category_service import CategoryService, slugify


def test_slugify():
    """Verify category slug formatting."""
    assert slugify("Solar & Inverter Setup") == "solar-inverter-setup"
    assert slugify("  Cleaning & Janitorial  ") == "cleaning-janitorial"
    assert slugify("Carpentry / Joinery") == "carpentry-joinery"


@pytest.mark.asyncio
async def test_category_create_whitespace_rejection():
    """Verify whitespace-only or empty name raises ValidationError."""
    svc = CategoryService()
    db = AsyncMock()

    with pytest.raises(ValidationError):
        await svc.create_category(db, "   ")

    with pytest.raises(Exception):
        CategoryCreate(name="  ")


@pytest.mark.asyncio
async def test_category_create_case_insensitive_duplicate():
    """Verify case-insensitive duplicate raises ConflictError."""
    svc = CategoryService()
    db = AsyncMock()

    existing = Category(
        id=uuid.uuid4(),
        name="Plumbing",
        slug="plumbing",
    )

    with patch("app.crud.category.get_by_name", new=AsyncMock(return_value=existing)):
        with pytest.raises(ConflictError) as exc_info:
            await svc.create_category(db, "plumbing")
        assert "already exists" in str(exc_info.value.message)

        with pytest.raises(ConflictError):
            await svc.create_category(db, "  PLUMBING  ")


@pytest.mark.asyncio
async def test_category_create_success():
    """Verify successful category creation stores user id and generates slug."""
    svc = CategoryService()
    db = AsyncMock()
    user_id = uuid.uuid4()

    created_cat = Category(
        id=uuid.uuid4(),
        name="Solar Installation",
        slug="solar-installation",
        created_by_id=user_id,
    )

    with patch("app.crud.category.get_by_name", new=AsyncMock(return_value=None)), \
         patch("app.crud.category.get_by_slug", new=AsyncMock(return_value=None)), \
         patch("app.crud.category.create", new=AsyncMock(return_value=created_cat)) as mock_create:

        out = await svc.create_category(db, "Solar Installation", user_id=user_id)
        assert out.name == "Solar Installation"
        assert out.slug == "solar-installation"
        assert out.created_by_id == user_id
        mock_create.assert_awaited_once_with(
            db,
            name="Solar Installation",
            slug="solar-installation",
            description=None,
            created_by_id=user_id,
        )
