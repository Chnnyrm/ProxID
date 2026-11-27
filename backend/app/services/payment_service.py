"""Job-scoped payment orchestration.

This service owns the receipt, the authorisation, the agent's spending limits and the
audit row. The rail is ``concordium.x402_service``, which speaks to the packaged
``@x402/concordium`` Server and Facilitator. It is not configured, so every path ends in
a receipt whose status is ``not_configured`` and a response that says so.

Two properties are load-bearing:

- No code path invents a transaction hash. A receipt has one only when the facilitator
  returned one from a real settlement.
- The agent's spending limits are checked before a payment requirement is created, not
  after. A refused payment never exists as an intent.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, time, timezone
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings
from ..core.errors import AuthorizationError, NotFoundError
from ..core.logging import get_logger
from ..crud import job as job_crud
from ..crud import user as user_crud
from ..crud import x402_receipt as receipt_crud
from ..models.job import Job
from ..models.user import User
from ..models.x402_receipt import X402Receipt
from ..schemas.x402 import X402ReceiptOut
from .concordium.audit_service import AuditService
from .concordium.x402_service import PaymentRequirements, SignedPayload, X402Service
from .spending_policy import AgentSpendingPolicy

logger = get_logger("payments")


@dataclass(frozen=True)
class PaymentView:
    """What the caller gets back: the honest state and the record behind it."""

    configured: bool
    status: str
    message: str
    network: str
    receipt: X402Receipt | None
    requirements: PaymentRequirements | None = None


def to_receipt_out(receipt: X402Receipt) -> X402ReceiptOut:
    """Map a receipt to its wire shape."""
    return X402ReceiptOut(
        id=receipt.id,
        job_id=receipt.job_id,
        amount=float(receipt.amount),
        currency=receipt.currency,
        status=receipt.status,
        network=receipt.network,
        x402_tx_hash=receipt.x402_tx_hash,
        payer_account=receipt.payer_account,
        payee_account=receipt.payee_account,
        is_demo=receipt.is_demo,
        failure_reason=receipt.failure_reason,
        created_at=receipt.created_at,
        settled_at=receipt.settled_at,
    )


def to_atomic_units(amount: Decimal | float, decimals: int) -> int:
    """Convert a money amount to atomic units, exactly.

    Done with Decimal and a shift, never with float multiplication: 0.1 * 10**6 is
    100000.00000000001 in binary floating point, and the protocol's exact-amount rule
    would reject that.
    """
    scaled = Decimal(str(amount)).scaleb(decimals)
    return int(scaled.to_integral_value())


def start_of_utc_day() -> datetime:
    """Midnight UTC today, the window the daily cap counts over."""
    today = datetime.now(timezone.utc).date()
    return datetime.combine(today, time.min, tzinfo=timezone.utc)


class PaymentService:
    """The x402 use cases, scoped to one job."""

    def __init__(
        self,
        settings: Settings,
        x402: X402Service,
        audit: AuditService,
        spending: AgentSpendingPolicy,
    ) -> None:
        self._settings = settings
        self._x402 = x402
        self._audit = audit
        self._spending = spending

    async def initiate(
        self,
        db: AsyncSession,
        actor: User,
        *,
        job_id: uuid.UUID,
        idempotency_key: str,
    ) -> PaymentView:
        """Build the payment requirement for a job the caller posted.

        Only the client pays. A repeated idempotency key returns the existing receipt
        rather than creating a second one, so a double-clicked button pays once. The
        agent's spending limits are checked here, before any requirement exists.
        """
        job = await job_crud.get_by_id(db, job_id)
        if job is None:
            raise NotFoundError(
                f"initiate_x402_payment failed: job_id={job_id} not found (layer=crud)",
                operation="initiate_x402_payment",
                external_message="We could not find that job. It may have been removed.",
            )
        if actor.id != job.client_id:
            raise AuthorizationError(
                f"initiate_x402_payment denied: actor={actor.id} is not the client of "
                f"job_id={job_id} (layer=service)",
                operation="initiate_x402_payment",
                external_message="Only the person who posted this job can pay for it.",
            )

        existing = await receipt_crud.get_by_idempotency_key(db, idempotency_key)
        if existing is not None:
            return self._view(existing)

        payee = await user_crud.get_by_id(db, job.provider_id) if job.provider_id else None
        payee_account = payee.concordium_account_address if payee else None
        spent_today = await receipt_crud.sum_settled_since(db, actor.id, start_of_utc_day())
        decision = self._spending.check_payment(
            agent_account=actor.agent_account_address,
            recipient_account=payee_account,
            amount=float(job.price),
            spent_today=spent_today,
        )
        if not decision.allowed:
            await self._audit.record(
                db,
                action="initiate_x402_payment",
                subject_type="job",
                subject_id=str(job.id),
                outcome="denied",
                actor_id=actor.id,
                detail={
                    "amount": float(job.price),
                    "status": decision.reason,
                    "configured": self._x402.is_configured,
                },
            )
            raise AuthorizationError(
                f"initiate_x402_payment denied by spending policy: reason={decision.reason} "
                f"actor={actor.id} job_id={job.id} (layer=service)",
                operation="initiate_x402_payment",
                external_message=decision.detail,
            )

        amount_minor = to_atomic_units(job.price, self._settings.X402_ASSET_DECIMALS)
        intent = await self._x402.initiate(
            job_id=job.id,
            amount_minor=amount_minor,
            description=f"ProxID job: {job.title}",
        )
        requirements = intent.requirements
        receipt = await receipt_crud.create(
            db,
            job_id=job.id,
            amount=float(job.price),
            currency=job.currency,
            payer_id=job.client_id,
            payee_id=job.provider_id,
            status="not_configured" if intent.status == "not_configured" else "pending",
            idempotency_key=idempotency_key,
            network="concordium",
            network_caip2=requirements.network if requirements else self._x402.network,
            asset=requirements.asset if requirements else self._settings.X402_ASSET,
            fee_payer=requirements.fee_payer if requirements else None,
            requirements=requirements.to_wire() if requirements else {},
        )
        await self._audit.record(
            db,
            action="initiate_x402_payment",
            subject_type="job",
            subject_id=str(job.id),
            outcome="not_configured" if intent.status == "not_configured" else "success",
            actor_id=actor.id,
            detail={
                "amount": float(job.price),
                "currency": job.currency,
                "status": intent.status,
                "configured": self._x402.is_configured,
            },
        )
        return PaymentView(
            configured=self._x402.is_configured,
            status=receipt.status,
            message=intent.detail,
            network=receipt.network,
            receipt=receipt,
            requirements=requirements,
        )

    async def settle(
        self,
        db: AsyncSession,
        actor: User,
        *,
        receipt_id: uuid.UUID,
        idempotency_key: str,
        signed_transaction: str | None = None,
        sender: str | None = None,
    ) -> PaymentView:
        """Settle a payment that was previously initiated.

        A receipt that is already settled returns unchanged: settlement is idempotent,
        so a retried request cannot pay twice. Without a signed payload there is nothing
        for the facilitator to verify, and the caller is told that rather than being
        handed an empty success.
        """
        receipt = await receipt_crud.get_by_id(db, receipt_id)
        if receipt is None:
            raise NotFoundError(
                f"settle_x402_payment failed: receipt_id={receipt_id} not found (layer=crud)",
                operation="settle_x402_payment",
                external_message="We could not find that payment. It may have been removed.",
            )
        if receipt.payer_id is not None and receipt.payer_id != actor.id:
            raise AuthorizationError(
                f"settle_x402_payment denied: actor={actor.id} is not the payer of "
                f"receipt_id={receipt_id} (layer=service)",
                operation="settle_x402_payment",
                external_message="Only the person who pays for this job can settle it.",
            )
        if receipt.status == "settled":
            return self._view(receipt)

        if not self._x402.is_configured:
            await self._audit.record(
                db,
                action="settle_x402_payment",
                subject_type="receipt",
                subject_id=str(receipt.id),
                outcome="not_configured",
                actor_id=actor.id,
                detail={"status": "not_configured", "settled": False},
            )
            return PaymentView(
                configured=False,
                status=receipt.status,
                message=(
                    "x402 is not connected yet. Nothing was settled and no transaction "
                    "hash exists."
                ),
                network=receipt.network,
                receipt=receipt,
            )

        if not signed_transaction or not sender:
            return PaymentView(
                configured=True,
                status=receipt.status,
                message="Open your wallet and sign the payment before we can settle it.",
                network=receipt.network,
                receipt=receipt,
            )

        requirements = _requirements_from_receipt(receipt, self._settings)
        settlement = await self._x402.settle(
            requirements=requirements,
            payload=SignedPayload(signed_transaction=signed_transaction, sender=sender),
        )
        if settlement.status == "settled" and settlement.tx_hash:
            receipt = await receipt_crud.mark_settled(db, receipt, tx_hash=settlement.tx_hash)
            job = await job_crud.get_by_id(db, receipt.job_id)
            if job is not None:
                # The settlement hash lands on the job, which is what a client reads.
                job.x402_tx_hash = settlement.tx_hash
                await db.flush()
        elif settlement.status == "failed":
            receipt = await receipt_crud.mark_failed(db, receipt, reason=settlement.detail)

        await self._audit.record(
            db,
            action="settle_x402_payment",
            subject_type="receipt",
            subject_id=str(receipt.id),
            outcome="success" if settlement.status == "settled" else "failed",
            actor_id=actor.id,
            detail={"status": settlement.status, "settled": settlement.status == "settled"},
        )
        return PaymentView(
            configured=True,
            status=receipt.status,
            message=settlement.detail,
            network=receipt.network,
            receipt=receipt,
        )

    async def preview_requirements(
        self, db: AsyncSession, actor: User, job_id: uuid.UUID
    ) -> PaymentRequirements:
        """The 402 body for a job, without creating a receipt.

        Uses the same adapter call the real initiation uses, so what the interface
        previews is what the rail would actually ask for.
        """
        job = await job_crud.get_by_id(db, job_id)
        if job is None:
            raise NotFoundError(
                f"preview_requirements failed: job_id={job_id} not found (layer=crud)",
                operation="preview_payment_requirements",
                external_message="We could not find that job. It may have been removed.",
            )
        if actor.id != job.client_id:
            raise AuthorizationError(
                f"preview_requirements denied: actor={actor.id} is not the client of job_id={job_id} (layer=service)",
                operation="preview_payment_requirements",
                external_message="Only the person who posted this job can pay for it.",
            )
        intent = await self._x402.initiate(
            job_id=job.id,
            amount_minor=to_atomic_units(job.price, self._settings.X402_ASSET_DECIMALS),
            description=f"ProxID job: {job.title}",
        )
        if intent.requirements is None:
            raise NotFoundError(
                f"preview_requirements failed: adapter returned no requirements for job_id={job_id} (layer=service)",
                operation="preview_payment_requirements",
                external_message="We could not prepare the payment details for this job yet.",
            )
        return intent.requirements

    async def status_for_job(
        self, db: AsyncSession, actor: User, job_id: uuid.UUID
    ) -> PaymentView | None:
        """The latest payment state for a job the caller takes part in."""
        job = await job_crud.get_by_id(db, job_id)
        if job is None or actor.id not in {job.client_id, job.provider_id}:
            raise NotFoundError(
                f"read_payment_status denied or missing: job_id={job_id} actor={actor.id} (layer=service)",
                operation="read_payment_status",
                external_message="We could not find that job. It may have been removed.",
            )
        receipt = await receipt_crud.get_latest_for_job(db, job_id)
        if receipt is None:
            return None
        return self._view(receipt)

    def _view(self, receipt: X402Receipt) -> PaymentView:
        """The view for an existing receipt."""
        if receipt.status == "not_configured":
            message = "x402 is not connected yet. No payment was requested and no money moved."
        elif receipt.is_demo:
            message = "This is demo data. It is not a payment and it is not on chain."
        else:
            message = "The payment record is shown below."
        return PaymentView(
            configured=self._x402.is_configured,
            status=receipt.status,
            message=message,
            network=receipt.network,
            receipt=receipt,
        )

    def limits(self) -> dict[str, object]:
        """The agent's spending limits, for the profile page."""
        return self._spending.describe_limits()

    async def fetch_fee_payer(self) -> str:
        """Fetch the current sponsor account from the facilitator /supported endpoint."""
        url = (self._settings.X402_FACILITATOR_URL or "https://proxid.onrender.com").rstrip("/")
        fallback = self._settings.X402_SPONSOR_ADDRESS or "3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{url}/supported")
                if res.status_code == 200:
                    data = res.json()
                    kinds = data.get("kinds") or []
                    if kinds and isinstance(kinds, list):
                        extra = kinds[0].get("extra") or {}
                        fee_payer = extra.get("feePayer")
                        if fee_payer:
                            return str(fee_payer)
                    signers = data.get("signers") or {}
                    for net_signers in signers.values():
                        if net_signers and isinstance(net_signers, list):
                            return str(net_signers[0])
        except Exception as exc:
            logger.warning(
                "failed to query facilitator /supported for fee payer, using fallback",
                extra={"error": str(exc)},
            )
        return fallback

    async def get_quote(
        self,
        *,
        amount: str = "1000000",
        asset: str = "CCD",
        pay_to: str | None = None,
        description: str = "ProxID verified service payment",
        job_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Generate an exact payment quote with network, asset, and fee payer."""
        fee_payer = await self.fetch_fee_payer()
        recipient = (
            pay_to
            or self._settings.CONCORDIUM_X402_MERCHANT_ACCOUNT
            or "3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW"
        )
        return {
            "x402Version": 2,
            "scheme": "exact",
            "network": self._settings.CONCORDIUM_CAIP2_NETWORK,
            "payTo": recipient,
            "amount": str(amount),
            "asset": asset,
            "description": description,
            "jobId": str(job_id) if job_id else None,
            "extra": {
                "feePayer": fee_payer,
            },
            "price": {
                "amount": str(amount),
                "asset": asset,
            },
        }

    async def verify_and_settle(
        self,
        db: AsyncSession,
        *,
        payment_payload: dict[str, Any],
        requirements: dict[str, Any],
        actor: User | None = None,
        correlation_id: str | None = None,
        job_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Verify with facilitator and settle on Concordium testnet."""
        url = (self._settings.X402_FACILITATOR_URL or "https://proxid.onrender.com").rstrip("/")
        timeout = float(self._settings.X402_FINALIZATION_TIMEOUT_SECONDS + 15)

        # 1. Forward to facilitator /verify
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                verify_res = await client.post(
                    f"{url}/verify",
                    headers={"Content-Type": "application/json"},
                    json={
                        "paymentPayload": payment_payload,
                        "paymentRequirements": requirements,
                    },
                )
                verify_data = verify_res.json() if verify_res.content else {}
            except Exception as exc:
                return {
                    "success": False,
                    "status": "failed",
                    "error": "facilitator_unreachable",
                    "errorReason": f"Could not reach facilitator /verify: {exc}",
                }

        is_valid = bool(verify_data.get("isValid") or verify_data.get("valid"))
        if not is_valid:
            reason = (
                verify_data.get("invalidReason")
                or verify_data.get("reason")
                or verify_data.get("error")
                or "Payment verification failed"
            )
            return {
                "success": False,
                "status": "failed",
                "error": "verification_failed",
                "errorReason": str(reason),
            }

        # 2. Forward to facilitator /settle
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                settle_res = await client.post(
                    f"{url}/settle",
                    headers={"Content-Type": "application/json"},
                    json={
                        "paymentPayload": payment_payload,
                        "paymentRequirements": requirements,
                    },
                )
                settle_data = settle_res.json() if settle_res.content else {}
            except Exception as exc:
                return {
                    "success": False,
                    "status": "failed",
                    "error": "settlement_timeout",
                    "errorReason": f"Facilitator settlement failed or timed out: {exc}",
                }

        success = bool(settle_data.get("success"))
        tx_hash = settle_data.get("transaction") or settle_data.get("txHash")
        if not success or not tx_hash:
            error_reason = (
                settle_data.get("errorReason")
                or settle_data.get("error")
                or "The facilitator did not settle the payment."
            )
            return {
                "success": False,
                "status": "failed",
                "error": "settlement_failed",
                "errorReason": str(error_reason),
            }

        # 3. Successful real settlement: record receipt and update job
        payer_account = (
            settle_data.get("payer")
            or payment_payload.get("payload", {}).get("sender")
            or self._settings.X402_PAYER_ADDRESS
        )
        payee_account = (
            requirements.get("payTo")
            or self._settings.CONCORDIUM_X402_MERCHANT_ACCOUNT
        )
        raw_amount = (
            requirements.get("price", {}).get("amount")
            or requirements.get("amount")
            or "1000000"
        )
        amount_ccd = Decimal(str(raw_amount)) / Decimal(10**6)

        target_job = None
        if job_id:
            target_job = await job_crud.get_by_id(db, job_id)
        if target_job is None:
            # Pick latest active job in the system
            result = await db.execute(select(Job).order_by(Job.created_at.desc()).limit(1))
            target_job = result.scalar_one_or_none()

        target_job_id = target_job.id if target_job else None
        if target_job:
            target_job.x402_tx_hash = str(tx_hash)

        receipt = None
        if target_job_id:
            receipt = await receipt_crud.create(
                db,
                job_id=target_job_id,
                amount=float(amount_ccd),
                currency="CCD",
                payer_id=actor.id if actor else target_job.client_id,
                payee_id=target_job.provider_id,
                status="settled",
                idempotency_key=f"settled-{tx_hash}",
                network="concordium",
                network_caip2=requirements.get("network") or self._settings.CONCORDIUM_CAIP2_NETWORK,
                asset="CCD",
                fee_payer=requirements.get("extra", {}).get("feePayer"),
                requirements=requirements,
            )
            receipt.x402_tx_hash = str(tx_hash)
            receipt.payer_account = str(payer_account) if payer_account else None
            receipt.payee_account = str(payee_account) if payee_account else None
            receipt.settled_at = datetime.now(timezone.utc)
            await db.flush()

            await self._audit.record(
                db,
                action="settle_x402_payment",
                subject_type="receipt",
                subject_id=str(receipt.id),
                outcome="success",
                actor_id=actor.id if actor else None,
                detail={
                    "tx_hash": str(tx_hash),
                    "amount": float(amount_ccd),
                    "payer": str(payer_account),
                    "payee": str(payee_account),
                    "correlation_id": correlation_id,
                },
            )

        return {
            "success": True,
            "status": "settled",
            "txHash": str(tx_hash),
            "transaction": str(tx_hash),
            "explorerUrl": f"https://testnet.ccdscan.io/?r={tx_hash}",
            "payer": str(payer_account),
            "payee": str(payee_account),
            "amount": str(raw_amount),
            "asset": "CCD",
            "receiptId": str(receipt.id) if receipt else None,
            "jobId": str(target_job_id) if target_job_id else None,
            "correlationId": correlation_id,
            "message": "Payment verified and settled on Concordium testnet.",
        }


def _requirements_from_receipt(
    receipt: X402Receipt, settings: Settings
) -> PaymentRequirements:
    """Rebuild the requirement a receipt was created from, for settlement."""
    stored = receipt.requirements or {}
    price = stored.get("price") or {}
    extra = stored.get("extra") or {}
    return PaymentRequirements(
        scheme=str(stored.get("scheme") or "exact"),
        network=str(stored.get("network") or settings.CONCORDIUM_CAIP2_NETWORK),
        pay_to=str(stored.get("payTo") or settings.CONCORDIUM_X402_MERCHANT_ACCOUNT),
        amount=str(
            price.get("amount")
            or to_atomic_units(receipt.amount, settings.X402_ASSET_DECIMALS)
        ),
        asset=str(price.get("asset") or receipt.asset or settings.X402_ASSET),
        description=str(stored.get("description") or ""),
        fee_payer=extra.get("feePayer") or receipt.fee_payer,
        max_timeout_seconds=int(
            stored.get("maxTimeoutSeconds") or settings.X402_MAX_EXPIRY_OFFSET_SECONDS
        ),
    )
