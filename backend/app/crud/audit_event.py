"""Persistence for the audit trail."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.audit_event import AuditEvent


async def create(
    db: AsyncSession,
    *,
    action: str,
    subject_type: str,
    outcome: str,
    actor_id: uuid.UUID | None = None,
    subject_id: str | None = None,
    detail: dict | None = None,
    correlation_id: str | None = None,
    client_ip: str | None = None,
    record_nonce: str = "",
    payload_hash: str = "",
) -> AuditEvent:
    """Append one audit row and flush.

    The caller's transaction decides whether it survives: an audit entry for an
    action that was rolled back must not be committed either.

    ``record_nonce`` and ``payload_hash`` are required by the Article 12 pattern: the
    nonce salts the hash, and the hash is the only thing that would ever be anchored.
    """
    event = AuditEvent(
        action=action,
        subject_type=subject_type,
        outcome=outcome,
        actor_id=actor_id,
        subject_id=subject_id,
        detail=detail or {},
        correlation_id=correlation_id,
        client_ip=client_ip,
        record_nonce=record_nonce,
        payload_hash=payload_hash,
    )
    db.add(event)
    await db.flush()
    return event


async def list_recent(
    db: AsyncSession, *, limit: int = 100, offset: int = 0
) -> list[AuditEvent]:
    """The most recent audit rows, newest first."""
    result = await db.execute(
        select(AuditEvent)
        .order_by(AuditEvent.created_at.desc(), AuditEvent.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())
