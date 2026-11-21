"""A job: the work one person needs and another accepts.

Status is the state machine of the product and is validated in the service, not
here. The database only guarantees it is one of the known values.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geography
from sqlalchemy import (
    CheckConstraint,
    Integer,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .base import DemoMarkMixin, TimestampMixin, UuidPrimaryKeyMixin

#: The only legal job states. Transitions are enforced in the job service.
JOB_STATUSES = (
    "open",
    "requested",
    "assigned",
    "in_progress",
    "completed",
    "cancelled",
    "disputed",
)

#: Terminal states, from which nothing may move.
TERMINAL_JOB_STATUSES = ("completed", "cancelled")


class Job(Base, UuidPrimaryKeyMixin, TimestampMixin, DemoMarkMixin):
    """One job posting and its lifecycle."""

    __tablename__ = "jobs"

    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    service_listing_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("service_listings.id", ondelete="SET NULL"), nullable=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    min_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    max_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="open")
    location: Mapped[object | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True
    )
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # How many messages this job's room holds. Maintained by the message service
    # inside the same transaction as the insert, so the browse ranking can order
    # by activity without joining another table.
    message_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    # The settlement hash of the x402 payment that closed this job. Null until a
    # real settlement has happened; a demo receipt never writes a fake hash here.
    x402_tx_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN (" + ", ".join(f"'{status}'" for status in JOB_STATUSES) + ")",
            name="ck_jobs_status",
        ),
        Index("ix_jobs_status", "status"),
        Index("ix_jobs_client_id", "client_id"),
        Index("ix_jobs_provider_id", "provider_id"),
        Index("ix_jobs_location", "location", postgresql_using="gist"),
        Index("ix_jobs_is_demo", "is_demo"),
    )
