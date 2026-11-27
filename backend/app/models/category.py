"""Service categories, the vocabulary both sides of the marketplace share."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .base import TimestampMixin, UuidPrimaryKeyMixin


class Category(Base, UuidPrimaryKeyMixin, TimestampMixin):
    """A kind of work, for example Plumbing or Cleaning.

    ``slug`` is stable and is what the agent and the URLs use; ``name`` is what a
    person reads and may be reworded without breaking a link.
    """

    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    __table_args__ = (Index("ix_categories_name_lower", name),)
