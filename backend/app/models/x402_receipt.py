"""The x402 payment record for a job.

x402 is the settlement rail. Until the Concordium credentials arrive, a receipt
can exist in exactly one honest state: ``not_configured``, with no hash and no
amount moved. A demo receipt is additionally marked ``is_demo``, and its status
is ``demo`` so a seed run can never look like a settled payment.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
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

#: The only receipt states. ``not_configured`` is the truthful state before the
#: integration exists; ``demo`` belongs to seeded rows only.
X402_RECEIPT_STATUSES = ("not_configured", "pending", "settled", "failed", "demo")


class X402Receipt(Base, UuidPrimaryKeyMixin, TimestampMixin, DemoMarkMixin):
    """What was asked for, and what the rail said."""

    __tablename__ = "x402_receipts"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    payer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    payee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="not_configured")
    network: Mapped[str] = mapped_column(String(16), nullable=False, default="concordium")
    # The on-chain settlement reference. Null until a real settlement happened.
    x402_tx_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    payer_account: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payee_account: Mapped[str | None] = mapped_column(String(64), nullable=True)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Why the last attempt did not settle, in words an engineer can act on.
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Makes a double-clicked "pay" button produce one receipt, not two. Unique, so
    # the database enforces it rather than a read-then-write check.
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)

    __table_args__ = (
        CheckConstraint(
            "status IN (" + ", ".join(f"'{status}'" for status in X402_RECEIPT_STATUSES) + ")",
            name="ck_x402_receipts_status",
        ),
        Index("ix_x402_receipts_job_id", "job_id"),
        Index("ix_x402_receipts_is_demo", "is_demo"),
    )
