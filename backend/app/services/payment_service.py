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

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings
from ..core.errors import AuthorizationError, NotFoundError
from ..core.logging import get_logger
from ..crud import job as job_crud
from ..crud import user as user_crud
from ..crud import x402_receipt as receipt_crud
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
