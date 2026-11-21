"""Category contracts."""

from __future__ import annotations

import uuid

from .common import OutputModel


class CategoryOut(OutputModel):
    """A category as a picker needs it."""

    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
