"""Category contracts."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from .base import OutputModel, TrimmedText


class CategoryCreate(TrimmedText):
    """Create a new category."""

    name: str = Field(min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=500)


class CategoryOut(OutputModel):
    """A category as a picker needs it."""

    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
    created_by_id: uuid.UUID | None = None
    created_at: datetime | None = None
