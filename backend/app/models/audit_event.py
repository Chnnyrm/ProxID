"""The audit trail: who did what, to which object, and whether it worked.

Separate from application logs because it is retained longer and is read by
people, not only by greps. Every action that grants access, moves money, sends
something, or changes a job's state writes one row. The Concordium audit service
owns the writes; today it writes locally and, once the registry is configured, the
same rows are the material for an on-chain anchor.
"""

from __future__ import annotations

import uuid

from datetime import datetime

from sqlalchemy import DateTime, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .base import TimestampMixin, UuidPrimaryKeyMixin

#: The outcomes an audited action can have.
AUDIT_OUTCOMES = ("success", "denied", "failed", "not_configured")


class AuditEvent(Base, UuidPrimaryKeyMixin, TimestampMixin):
    """One auditable action."""

    __tablename__ = "audit_events"

    # Nullable because a refused action may have no authenticated actor.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    subject_type: Mapped[str] = mapped_column(String(32), nullable=False)
    subject_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    detail: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    client_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # GDPR-safe pattern for EU AI Act Article 12: the record lives here, a random
    # per-record nonce salts it, only the hash of (nonce + canonical payload) is
    # ever anchored on chain. Delete this row later and the on-chain hash can never
    # be matched back to a payload, which is what makes erasure real.
    record_nonce: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    anchor_tx_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    anchored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_audit_events_action_created", "action", "created_at"),
        Index("ix_audit_events_actor_id", "actor_id"),
        Index("ix_audit_events_subject", "subject_type", "subject_id"),
    )
