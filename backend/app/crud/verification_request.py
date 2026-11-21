"""Persistence for verification requests.

Single use and expiry are enforced here as conditional database writes, not as
read-then-write checks, so two concurrent approvals cannot both consume one request.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.verification_request import VerificationRequest


async def create(
    db: AsyncSession,
    *,
    nonce: str,
    bound_domain: str,
    expires_at: datetime,
    purpose: str = "personhood",
    user_id: uuid.UUID | None = None,
    qr_payload: str | None = None,
    request_anchor_ref: str | None = None,
    is_demo: bool = False,
    status: str = "pending",
) -> VerificationRequest:
    """Insert one verification request and flush."""
    request = VerificationRequest(
        nonce=nonce,
        bound_domain=bound_domain,
        expires_at=expires_at,
        purpose=purpose,
        user_id=user_id,
        qr_payload=qr_payload,
        request_anchor_ref=request_anchor_ref,
        is_demo=is_demo,
        status=status,
    )
    db.add(request)
    await db.flush()
    return request


async def get_by_nonce(db: AsyncSession, nonce: str) -> VerificationRequest | None:
    """One request by its nonce, or None."""
    if not nonce:
        return None
    result = await db.execute(
        select(VerificationRequest).where(VerificationRequest.nonce == nonce)
    )
    return result.scalar_one_or_none()


async def get_latest_for_user(
    db: AsyncSession, user_id: uuid.UUID
) -> VerificationRequest | None:
    """The most recent request for a person, for the profile page."""
    result = await db.execute(
        select(VerificationRequest)
        .where(VerificationRequest.user_id == user_id)
        .order_by(VerificationRequest.created_at.desc(), VerificationRequest.id.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def consume(db: AsyncSession, nonce: str) -> bool:
    """Mark a pending request consumed, atomically.

    Returns False when the request was already consumed, already decided, or has
    expired: all three mean the proof must not be accepted. The expiry check is in
    the WHERE clause so a slow request cannot win a race against its own deadline.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(VerificationRequest)
        .where(
            VerificationRequest.nonce == nonce,
            VerificationRequest.status == "pending",
            VerificationRequest.expires_at > now,
        )
        .values(status="consumed", consumed_at=now)
    )
    return bool(result.rowcount)


async def record_outcome(
    db: AsyncSession,
    nonce: str,
    *,
    status: str,
    zk_proof_ref: str | None = None,
    audit_anchor_ref: str | None = None,
    outcome_detail: dict | None = None,
) -> bool:
    """Store the verifier's answer on a consumed request."""
    result = await db.execute(
        update(VerificationRequest)
        .where(VerificationRequest.nonce == nonce)
        .values(
            status=status,
            zk_proof_ref=zk_proof_ref,
            audit_anchor_ref=audit_anchor_ref,
            outcome_detail=outcome_detail or {},
        )
    )
    return bool(result.rowcount)


async def expire_stale(db: AsyncSession) -> int:
    """Expire pending requests whose deadline passed. Returns how many changed."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(VerificationRequest)
        .where(
            VerificationRequest.status == "pending",
            VerificationRequest.expires_at <= now,
        )
        .values(status="expired")
    )
    return int(result.rowcount or 0)
