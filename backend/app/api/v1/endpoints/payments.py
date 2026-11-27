"""x402 payment routes.

Both routes return a ``not_configured`` receipt today. That is the whole point: the
structure and the interfaces exist, the rail does not, and the response says so
without inventing a transaction hash.
"""

from __future__ import annotations

import base64
import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....schemas.x402 import (
    PaymentQuoteOut,
    PaymentQuoteRequest,
    X402ActionOut,
    X402InitiateRequest,
    X402ReceiptOut,
    X402RequirementsOut,
    X402SettleRequest,
)
from ...deps import CurrentUser, get_container, get_current_user, get_db, get_optional_user

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


@router.post("/quote", response_model=PaymentQuoteOut)
async def payment_quote(
    payload: PaymentQuoteRequest = PaymentQuoteRequest(),
    container: Container = Depends(get_container),
) -> dict[str, Any]:
    """Provide exact payment requirements for client signing."""
    return await container.payments.get_quote(
        amount=payload.amount,
        asset=payload.asset,
        pay_to=payload.pay_to,
        description=payload.description,
        job_id=payload.job_id,
    )


async def _handle_protected_resource(
    request: Request,
    db: AsyncSession,
    container: Container,
    current_user: CurrentUser | None,
) -> Response:
    raw_payment = (
        request.headers.get("X-PAYMENT")
        or request.headers.get("x-payment")
        or request.headers.get("Payment-Signature")
        or request.headers.get("payment-signature")
    )

    body_payload: dict[str, Any] | None = None
    if request.method == "POST":
        try:
            body_payload = await request.json()
        except Exception:
            body_payload = None

    if not raw_payment and not (
        body_payload
        and (
            "payload" in body_payload
            or "paymentPayload" in body_payload
            or "signedTransaction" in body_payload
        )
    ):
        quote = await container.payments.get_quote()
        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            headers={
                "Payment-Required": json.dumps(quote),
                "X-Payment-Required": json.dumps(quote),
            },
            content={
                "error": "Payment Required",
                "message": "Payment required to access this protected ProxID resource.",
                "amount": quote["amount"],
                "asset": quote["asset"],
                "payTo": quote["payTo"],
                "network": quote["network"],
                "extra": quote["extra"],
                "scheme": quote["scheme"],
                "x402Version": quote["x402Version"],
                "price": quote["price"],
                "description": quote["description"],
            },
        )

    parsed_payment: dict[str, Any] = {}
    if raw_payment:
        raw_str = raw_payment.strip()
        if raw_str.startswith("{"):
            try:
                parsed_payment = json.loads(raw_str)
            except Exception:
                pass
        else:
            try:
                decoded = base64.b64decode(raw_str).decode("utf-8")
                parsed_payment = json.loads(decoded)
            except Exception:
                pass

    if not parsed_payment and body_payload:
        parsed_payment = body_payload

    payment_payload = (
        parsed_payment.get("paymentPayload")
        or parsed_payment.get("payload")
        or parsed_payment
    )
    requirements = (
        parsed_payment.get("paymentRequirements")
        or parsed_payment.get("requirements")
    )

    if not requirements:
        quote = await container.payments.get_quote()
        requirements = quote

    correlation_id = (
        request.headers.get("X-Request-ID")
        or getattr(request.state, "correlation_id", None)
    )

    result = await container.payments.verify_and_settle(
        db,
        payment_payload=payment_payload,
        requirements=requirements,
        actor=current_user,
        correlation_id=correlation_id,
    )

    if not result.get("success"):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "status": "failed",
                "error": result.get("error", "payment_failed"),
                "errorReason": result.get("errorReason") or "Payment processing failed",
            },
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "status": "settled",
            "txHash": result["txHash"],
            "transaction": result["txHash"],
            "explorerUrl": result["explorerUrl"],
            "payer": result["payer"],
            "payee": result["payee"],
            "amount": result["amount"],
            "asset": result["asset"],
            "receiptId": result.get("receiptId"),
            "jobId": result.get("jobId"),
            "correlationId": result.get("correlationId"),
            "data": {
                "message": "Access granted to protected ProxID resource.",
                "resource": "proxid://verified-settlement-proof",
            },
        },
    )


@router.get("/protected-resource")
async def get_protected_resource(
    request: Request,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser | None = Depends(get_optional_user),
) -> Response:
    """An x402 protected resource requiring payment before granting access."""
    return await _handle_protected_resource(request, db, container, current_user)


@router.post("/protected-resource")
async def post_protected_resource(
    request: Request,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser | None = Depends(get_optional_user),
) -> Response:
    """An x402 protected resource requiring payment before granting access."""
    return await _handle_protected_resource(request, db, container, current_user)
