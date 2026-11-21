"""Persistence for x402 receipts."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.x402_receipt import X402Receipt


async def get_by_id(db: AsyncSession, receipt_id: uuid.UUID) -> X402Receipt | None:
    """One receipt by id, or None."""
    result = await db.execute(select(X402Receipt).where(X402Receipt.id == receipt_id))
    return result.scalar_one_or_none()


async def get_latest_for_job(db: AsyncSession, job_id: uuid.UUID) -> X402Receipt | None:
    """The most recent receipt for a job, or None when nothing was ever asked for."""
    result = await db.execute(
        select(X402Receipt)
        .where(X402Receipt.job_id == job_id)
        .order_by(X402Receipt.created_at.desc(), X402Receipt.id.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_by_idempotency_key(db: AsyncSession, key: str) -> X402Receipt | None:
    """A receipt created by a previous attempt with the same idempotency key."""
    if not key:
        return None
    result = await db.execute(
        select(X402Receipt).where(X402Receipt.idempotency_key == key).limit(1)
    )
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    job_id: uuid.UUID,
    amount: float,
    currency: str,
    payer_id: uuid.UUID | None,
    payee_id: uuid.UUID | None,
    status: str,
    idempotency_key: str | None = None,
    network: str = "concordium",
    network_caip2: str | None = None,
    asset: str | None = None,
    fee_payer: str | None = None,
    requirements: dict | None = None,
    is_demo: bool = False,
    failure_reason: str | None = None,
) -> X402Receipt:
    """Insert one receipt and flush. No hash is ever invented here."""
    receipt = X402Receipt(
        job_id=job_id,
        amount=amount,
        currency=currency,
        payer_id=payer_id,
        payee_id=payee_id,
        status=status,
        network=network,
        network_caip2=network_caip2,
        asset=asset,
        fee_payer=fee_payer,
        requirements=requirements or {},
        idempotency_key=idempotency_key,
        is_demo=is_demo,
        failure_reason=failure_reason,
    )
    db.add(receipt)
    await db.flush()
    return receipt


async def mark_settled(
    db: AsyncSession, receipt: X402Receipt, *, tx_hash: str, settled_at: datetime | None = None
) -> X402Receipt:
    """Record a real settlement. Refuses an empty hash: an unhashed settlement is a lie."""
    if not tx_hash:
        raise ValueError("a settled receipt requires a transaction hash")
    receipt.status = "settled"
    receipt.x402_tx_hash = tx_hash
    receipt.settled_at = settled_at or datetime.now(timezone.utc)
    await db.flush()
    return receipt


async def mark_failed(
    db: AsyncSession, receipt: X402Receipt, *, reason: str
) -> X402Receipt:
    """Record why an attempt did not settle. No hash, no settlement time."""
    receipt.status = "failed"
    receipt.failure_reason = reason
    await db.flush()
    return receipt


async def sum_settled_since(
    db: AsyncSession, payer_id: uuid.UUID, since: datetime
) -> float:
    """How much this payer has actually settled since a moment, in one query.

    Only ``settled`` receipts count: a demo receipt and a not-configured receipt moved
    nothing, so counting them would make the agent's daily cap lie.
    """
    result = await db.execute(
        select(func.coalesce(func.sum(X402Receipt.amount), 0)).where(
            X402Receipt.payer_id == payer_id,
            X402Receipt.status == "settled",
            X402Receipt.settled_at.isnot(None),
            X402Receipt.settled_at >= since,
        )
    )
    return float(result.scalar_one() or 0)
