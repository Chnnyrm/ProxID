"""x402 payment routes.

Both routes return a ``not_configured`` receipt today. That is the whole point: the
structure and the interfaces exist, the rail does not, and the response says so
without inventing a transaction hash.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....schemas.x402 import X402ActionOut, X402InitiateRequest, X402ReceiptOut, X402RequirementsOut, X402SettleRequest
from ...deps import CurrentUser, get_container, get_current_user, get_db

router = APIRouter()


@router.post("/x402/initiate", response_model=X402ActionOut, status_code=status.HTTP_202_ACCEPTED)
async def initiate_x402_payment(
    payload: X402InitiateRequest,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> X402ActionOut:
    """Create the payment record for a job and ask the rail to require payment.

    ``202 Accepted`` is the honest status while unconfigured: the request was
    understood and recorded, and nothing was charged.
    """
    from ....services.payment_service import to_receipt_out

    view = await container.payments.initiate(
        db,
        current_user,
        job_id=payload.job_id,
        idempotency_key=payload.idempotency_key,
    )
    return X402ActionOut(
        configured=view.configured,
        status=view.status,
        message=view.message,
        network=view.network,
        receipt=to_receipt_out(view.receipt) if view.receipt else None,
    )


@router.post("/x402/settle", response_model=X402ActionOut)
async def settle_x402_payment(
    payload: X402SettleRequest,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> X402ActionOut:
    """Settle a payment record. No hash exists until the rail returns one."""
    from ....services.payment_service import to_receipt_out

    view = await container.payments.settle(
        db,
        current_user,
        receipt_id=payload.receipt_id,
        idempotency_key=payload.idempotency_key,
        signed_transaction=payload.signed_transaction,
        sender=payload.sender,
    )
    return X402ActionOut(
        configured=view.configured,
        status=view.status,
        message=view.message,
        network=view.network,
        receipt=to_receipt_out(view.receipt) if view.receipt else None,
    )


@router.get("/x402/job/{job_id}", response_model=X402ReceiptOut | None)
async def payment_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> X402ReceiptOut | None:
    """The latest payment record for a job, or nothing when none was requested."""
    from ....services.payment_service import to_receipt_out

    view = await container.payments.status_for_job(db, current_user, job_id)
    return to_receipt_out(view.receipt) if view and view.receipt else None


@router.get("/x402/limits")
async def spending_limits(container: Container = Depends(get_container)) -> dict[str, object]:
    """The agent's client-side spending limits.

    Protocol-level account locks are DevNet only, so these caps are the isolation that
    exists today. The response says so, so nobody believes the lock is on chain.
    """
    return container.spending.describe_limits()


@router.get("/x402/requirements/{job_id}", response_model=X402RequirementsOut)
async def preview_requirements(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> X402RequirementsOut:
    """The 402 body a payment for this job would carry, without creating a receipt."""
    view = await container.payments.preview_requirements(db, current_user, job_id)
    return X402RequirementsOut(**view.to_wire())
