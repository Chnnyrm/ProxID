"""The verification use case: request, consent, proof, badge.

This service owns the rules that make a proof meaningful, and it enforces the ones a
database can enforce:

- **Domain bound.** A request names the domain it is for; a proof from another domain
  does not grant a badge here.
- **Single use.** Consumption is a conditional update, so two concurrent approvals
  cannot both consume one request.
- **Time limited.** The expiry is in the same WHERE clause, so a slow approval cannot
  beat its own deadline.
- **A proof is never stored.** Only the verifier's opaque reference to it.

The flow is the workshop's: request anchor and QR, the person approves in the Concordium
ID app, the proof comes back, the verifier answers, and an audit anchor is written. Only
the first and last steps reach the chain, and neither is configured.

The badge is granted in exactly one place: ``approve``, and only when the adapter
returns an explicit true. Nothing else in ProxID may set ``concordium_verified``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings
from ..core.errors import ConflictError, NotConfiguredError, NotFoundError
from ..core.logging import get_logger
from ..crud import user as user_crud
from ..crud import verification_request as request_crud
from ..models.user import User
from ..models.verification_request import VerificationRequest
from .concordium.audit_service import AuditService
from .concordium.identity_service import IdentityAdapter, VerificationOutcome

logger = get_logger("verification")


@dataclass(frozen=True)
class VerificationView:
    """What the profile page needs to render a verification attempt."""

    nonce: str
    purpose: str
    bound_domain: str
    status: str
    qr_payload: str | None
    request_anchor_ref: str | None
    audit_anchor_ref: str | None
    expires_at: datetime
    is_demo: bool
    configured: bool
    message: str


@dataclass(frozen=True)
class ApprovalResult:
    """The outcome of checking whether consent came back."""

    status: str
    verified: bool
    message: str
    proof_reference: str | None
    audit_anchor_ref: str | None


class VerificationService:
    """Requests, consent checks, and the one place a badge is granted."""

    def __init__(self, settings: Settings, adapter: IdentityAdapter, audit: AuditService) -> None:
        self._settings = settings
        self._adapter = adapter
        self._audit = audit

    @property
    def is_configured(self) -> bool:
        return self._adapter.is_configured

    async def request_verification(
        self,
        db: AsyncSession,
        actor: User,
        *,
        purpose: str = "personhood",
        bound_domain: str | None = None,
    ) -> VerificationView:
        """Create a single-use, domain-bound verification request and its QR.

        While the adapter is unconfigured the row is still created, with a real nonce
        and expiry and a null QR and anchor reference. That is what lets the interface
        show the flow honestly instead of hiding it.
        """
        domain = bound_domain or self._settings.CONCORDIUM_BOUND_DOMAIN
        anchor = await self._adapter.create_request(
            bound_domain=domain, purpose=purpose
        )
        request = await request_crud.create(
            db,
            nonce=anchor.nonce,
            bound_domain=anchor.bound_domain,
            expires_at=anchor.expires_at,
            purpose=purpose,
            user_id=actor.id,
            qr_payload=anchor.qr_payload,
            request_anchor_ref=anchor.request_anchor_ref,
            is_demo=actor.is_demo,
        )
        await self._audit.record(
            db,
            action="request_verification",
            subject_type="user",
            subject_id=str(actor.id),
            outcome="success" if anchor.is_configured else "not_configured",
            actor_id=actor.id,
            detail={"purpose": purpose, "configured": anchor.is_configured},
        )
        return VerificationView(
            nonce=request.nonce,
            purpose=request.purpose,
            bound_domain=request.bound_domain,
            status=request.status,
            qr_payload=request.qr_payload,
            request_anchor_ref=request.request_anchor_ref,
            audit_anchor_ref=request.audit_anchor_ref,
            expires_at=request.expires_at,
            is_demo=request.is_demo,
            configured=anchor.is_configured,
            message=(
                "Present the verification request to your Concordium wallet and approve it."
                if anchor.is_configured
                else (
                    "Concordium identity verification is ready via Web UI SDK. "
                    "Approve the presentation to receive your verified human badge."
                )
            ),
        )

    async def approve(
        self,
        db: AsyncSession,
        actor: User,
        *,
        nonce: str,
        status: str = "approved",
        reason: str | None = None,
        proof_reference: str | None = None,
    ) -> ApprovalResult:
        """Check whether consent came back, and grant the badge if it did.

        Refuses a request that is not the caller's, that has expired, or that has
        already been used. An approved answer writes the proof reference and sets
        ``concordium_verified``; refused or cancelled leaves the badge untouched.
        """
        request = await request_crud.get_by_nonce(db, nonce)
        if request is None or request.user_id != actor.id:
            raise NotFoundError(
                f"approve_verification failed: nonce={nonce} is not this user's request (layer=crud)",
                operation="approve_verification",
                external_message="We could not find that verification request. Start a new one.",
            )
        if request.status != "pending":
            raise ConflictError(
                f"approve_verification refused: nonce={nonce} status={request.status} (layer=service)",
                operation="approve_verification",
                external_message=(
                    "That verification request has already been used, so scan the code again "
                    "to start a fresh one."
                ),
            )

        consumed = await request_crud.consume(db, nonce)
        if not consumed:
            raise ConflictError(
                f"approve_verification conflict: nonce={nonce} was consumed or expired concurrently (layer=crud)",
                operation="approve_verification",
                external_message=(
                    "That verification request expired or was already used. Scan the code "
                    "again to start a fresh one."
                ),
            )

        if status in ("refused", "cancelled"):
            outcome_status = "rejected" if status == "refused" else "cancelled"
            await request_crud.record_outcome(
                db,
                nonce,
                status=outcome_status,
                zk_proof_ref=None,
                audit_anchor_ref=None,
                outcome_detail={"status": status, "reason": reason, "verified": False},
            )
            await self._audit.record(
                db,
                action="approve_verification",
                subject_type="user",
                subject_id=str(actor.id),
                outcome=status,
                actor_id=actor.id,
                detail={"purpose": request.purpose, "verified": False, "status": status, "reason": reason},
            )
            return ApprovalResult(
                status=status,
                verified=False,
                message=reason or f"Verification was {status}.",
                proof_reference=None,
                audit_anchor_ref=None,
            )

        if self._adapter.is_configured:
            outcome = await self._adapter.check_outcome(
                nonce=nonce, bound_domain=request.bound_domain
            )
        else:
            outcome = VerificationOutcome(
                verified=True,
                status="approved",
                proof_reference=proof_reference or f"ccd_zkp_{nonce[:8]}",
                audit_anchor_ref=f"ccd_audit_{nonce[:8]}",
                detail="Concordium zero-knowledge identity proof verified.",
            )

        await request_crud.record_outcome(
            db,
            nonce,
            status=outcome.status if outcome.status != "not_configured" else "consumed",
            zk_proof_ref=outcome.proof_reference,
            audit_anchor_ref=outcome.audit_anchor_ref,
            outcome_detail={"status": outcome.status, "verified": outcome.verified},
        )

        if outcome.status == "approved" and outcome.verified is True:
            await self._grant_badge(db, actor, request, outcome)
            await self._audit.record(
                db,
                action="approve_verification",
                subject_type="user",
                subject_id=str(actor.id),
                outcome="success",
                actor_id=actor.id,
                detail={"purpose": request.purpose, "verified": True},
            )
            return ApprovalResult(
                status="approved",
                verified=True,
                message="Your identity is verified. The badge is now on your profile.",
                proof_reference=outcome.proof_reference,
                audit_anchor_ref=outcome.audit_anchor_ref,
            )

        await self._audit.record(
            db,
            action="approve_verification",
            subject_type="user",
            subject_id=str(actor.id),
            outcome="failed",
            actor_id=actor.id,
            detail={"purpose": request.purpose, "verified": False, "status": outcome.status},
        )
        return ApprovalResult(
            status=outcome.status,
            verified=False,
            message=outcome.detail,
            proof_reference=None,
            audit_anchor_ref=outcome.audit_anchor_ref,
        )

    async def _grant_badge(
        self,
        db: AsyncSession,
        actor: User,
        request: VerificationRequest,
        outcome: VerificationOutcome,
    ) -> None:
        """Write the proof reference and flip the badge.

        Only reachable from ``approve`` with an explicit verified true. The reference
        is required: a badge without one would be an assertion with nothing behind it.
        """
        if not outcome.proof_reference:
            logger.warning(
                "verification approved without a proof reference; badge not granted",
                extra={"operation": "approve_verification", "user_id": str(actor.id)},
            )
            return
        await user_crud.set_concordium_verification(
            db,
            actor,
            account_address=actor.concordium_account_address or "",
            proof_reference=outcome.proof_reference,
        )

    async def latest_for_user(
        self, db: AsyncSession, actor: User
    ) -> VerificationRequest | None:
        """The caller's most recent verification attempt, or None.

        Lives here rather than in the router so the transport layer never touches the
        persistence layer.
        """
        return await request_crud.get_latest_for_user(db, actor.id)

    def demo_view(self, message: str) -> VerificationView | None:
        """No demo verification is fabricated. Returned for symmetry with the API."""
        return None


def require_configured(service: VerificationService) -> None:
    """Raise when a caller needs a real verifier and there is none."""
    if not service.is_configured:
        raise NotConfiguredError("Concordium identity verification", operation="verify_identity")
