"""A Verification Request Anchor, and the row that proves what happened.

The flow this models, from the Verify & Access workshop:

1. The site posts a time-limited, single-use, domain-bound Verification Request
   Anchor on chain and shows a QR code.
2. The person scans it with the Concordium ID app, approves, and their zero-knowledge
   proof comes back.
3. The site verifies the proof and posts a Verification Audit Anchor on chain.

Both anchors are CBOR-encoded and written with a ``registerData`` transaction.

This table is the off-chain half: the request, its nonce, its expiry, and whether it
was consumed. It enforces single use and expiry in the database, which is what makes
the flow replay-proof even if the adapter is swapped.

In the Judge Demo a request row exists with ``is_demo`` true and status
``demo_approved``. It is a demonstration of the flow, not a proof: a real row only
ever reaches ``approved`` after a real proof came back.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .base import DemoMarkMixin, TimestampMixin, UuidPrimaryKeyMixin

#: Every state a verification request can be in.
VERIFICATION_STATUSES = (
    "pending",
    "approved",
    "rejected",
    "expired",
    "consumed",
    "demo_approved",
)

#: What the person is proving. Age is a separate purpose because a proof of age
#: reveals less than a proof of identity.
VERIFICATION_PURPOSES = ("personhood", "age_over_18")


class VerificationRequest(Base, UuidPrimaryKeyMixin, TimestampMixin, DemoMarkMixin):
    """One single-use, domain-bound verification attempt."""

    __tablename__ = "verification_requests"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    purpose: Mapped[str] = mapped_column(String(32), nullable=False, default="personhood")
    # The domain the request is bound to. A proof for one site is not valid on
    # another, which is why this is stored rather than trusted from the caller.
    bound_domain: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")

    # Random, single use, never derived from the account.
    nonce: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # The QR payload the person scans, and the on-chain reference of the request
    # anchor. Both null until the identity adapter creates a real request.
    qr_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_anchor_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # The immutable audit anchor written after a successful verification.
    audit_anchor_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # An opaque handle to the proof held by the verifier. Never the proof.
    zk_proof_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # What the verifier answered, verbatim and minimal.
    outcome_detail: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    __table_args__ = (
        CheckConstraint(
            "status IN (" + ", ".join(f"'{status}'" for status in VERIFICATION_STATUSES) + ")",
            name="ck_verification_requests_status",
        ),
        Index("ix_verification_requests_user_id", "user_id"),
        Index("ix_verification_requests_status_expires", "status", "expires_at"),
        Index("ix_verification_requests_is_demo", "is_demo"),
    )
