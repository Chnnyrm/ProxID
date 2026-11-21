"""Shared column mixins for the entities."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


def utc_now() -> datetime:
    """Timezone-aware now. Never store a naive timestamp."""
    return datetime.now(timezone.utc)


class UuidPrimaryKeyMixin:
    """A client-generatable UUID primary key.

    UUIDs rather than serial integers because ids appear in URLs and in agent tool
    arguments, and a sequential id leaks how many jobs exist.
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    """Creation and modification times, both timezone-aware, both server-defaulted."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class DemoMarkMixin:
    """Marks a row as demo seed data in the row itself.

    Judge Demo rows carry this so they can never be mistaken for a real record,
    regardless of what the interface says. Every query that returns
    on-chain-shaped facts (verification, receipts) exposes the flag.
    """

    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
