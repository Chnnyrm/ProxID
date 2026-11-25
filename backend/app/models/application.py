"""Application model: a provider applying to an open job.
Pure ASCII.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .base import TimestampMixin, UuidPrimaryKeyMixin

APPLICATION_STATUSES = ("pending", "accepted", "rejected", "withdrawn")


class Application(Base, UuidPrimaryKeyMixin, TimestampMixin):
    """An application by a provider to an open job."""

    __tablename__ = "applications"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    applicant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")

    __table_args__ = (
        UniqueConstraint("job_id", "applicant_id", name="uq_applications_job_applicant"),
        Index("ix_applications_job_id", "job_id"),
        Index("ix_applications_applicant_id", "applicant_id"),
        Index("ix_applications_status", "status"),
    )
