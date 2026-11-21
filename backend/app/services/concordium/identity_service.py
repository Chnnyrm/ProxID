"""Proof of personhood, behind a narrow adapter.

The Verify & Access flow this module is shaped around, from the Concordium workshop:

1. The site posts a time-limited, single-use, domain-bound Verification Request
   Anchor on chain and shows a QR code.
2. The person scans it with the Concordium ID app, approves, and sends the
   zero-knowledge proof back.
3. The site verifies the proof and posts a Verification Audit Anchor on chain.
4. Both anchors are CBOR-encoded and written with a ``registerData`` transaction.

Two implementations sit behind one interface:

- ``VerioxIdentityAdapter`` talks to Veriox (demo.veriox.io), which handles QR
  generation, chain anchoring and a true-or-false answer.
- ``StubIdentityAdapter`` answers ``not_configured`` and calls nothing.

Why the paths are configuration and not constants: demo.veriox.io was inspected on
21 Nov 2026 and serves an age-gated storefront. It publishes no API schema, no
endpoint list and no response shape. Writing guessed paths into code would be
inventing an integration, so the adapter refuses to run until the real paths are
supplied in configuration.

What is real here: the domain binding, the single-use nonce, the expiry window, and
the rule that a proof is never stored, only the verifier's reference to it.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Literal, Protocol

import httpx

from ...core.config import Settings
from ...core.errors import DependencyUnavailableError, NotConfiguredError
from ...core.logging import get_logger
from ...core.resilience import DependencyGuard

logger = get_logger("concordium.identity")

#: What a verification attempt can report. ``not_configured`` is distinct from
#: ``rejected`` on purpose: a refusal is a decision, and we have not made one.
VerificationStatus = Literal["not_configured", "approved", "rejected", "pending"]


@dataclass(frozen=True)
class VerificationRequestAnchor:
    """The request the site posts before the person does anything.

    ``nonce`` is random and single use. ``bound_domain`` is the site the proof is for:
    a proof minted for another domain must not unlock this one.
    """

    nonce: str
    bound_domain: str
    purpose: str
    expires_at: datetime
    qr_payload: str | None
    request_anchor_ref: str | None
    is_configured: bool


@dataclass(frozen=True)
class VerificationOutcome:
    """The verifier's answer.

    ``verified`` is a tri-state on purpose: ``None`` means no verification was
    performed, which is different from ``False`` (a proof was checked and refused).
    """

    verified: bool | None
    status: VerificationStatus
    proof_reference: str | None
    audit_anchor_ref: str | None
    detail: str
    raw: dict = field(default_factory=dict)


class IdentityAdapter(Protocol):
    """The seam. An implementation may be swapped without touching a service."""

    @property
    def is_configured(self) -> bool: ...

    async def create_request(
        self, *, bound_domain: str, purpose: str
    ) -> VerificationRequestAnchor: ...

    async def check_outcome(self, *, nonce: str, bound_domain: str) -> VerificationOutcome: ...


def new_nonce() -> str:
    """128 bits of randomness, hex. Never derived from the account or the clock."""
    return secrets.token_hex(16)


class StubIdentityAdapter:
    """The honest default: no verifier is connected, so nothing is verified."""

    @property
    def is_configured(self) -> bool:
        return False

    async def create_request(
        self, *, bound_domain: str, purpose: str
    ) -> VerificationRequestAnchor:
        """Return the request we would have posted, clearly not anchored.

        The nonce, domain, purpose and expiry are real values the caller stores, so
        the rest of the flow can be exercised; ``is_configured`` is false and both
        anchor references are null, so nothing can be mistaken for an on-chain record.
        """
        return VerificationRequestAnchor(
            nonce=new_nonce(),
            bound_domain=bound_domain,
            purpose=purpose,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            qr_payload=None,
            request_anchor_ref=None,
            is_configured=False,
        )

    async def check_outcome(self, *, nonce: str, bound_domain: str) -> VerificationOutcome:
        """Never claim a verification that did not happen."""
        return VerificationOutcome(
            verified=None,
            status="not_configured",
            proof_reference=None,
            audit_anchor_ref=None,
            detail=(
                "Concordium identity verification is not connected yet. No proof was "
                "requested, none was checked, and no verified badge was granted."
            ),
        )


class VerioxIdentityAdapter:
    """The Veriox-backed implementation of the same interface.

    Sends the request to the configured paths with the configured API key. Refuses to
    operate when the base URL, the key or either path is missing, because a guessed
    path is a fabricated integration.
    """

    def __init__(self, settings: Settings, guard: DependencyGuard) -> None:
        self._settings = settings
        self._guard = guard

    @property
    def is_configured(self) -> bool:
        return bool(
            self._settings.veriox_configured
            and self._settings.VERIOX_REQUEST_PATH
            and self._settings.VERIOX_STATUS_PATH
        )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._settings.VERIOX_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _url(self, path: str) -> str:
        return f"{self._settings.VERIOX_BASE_URL.rstrip('/')}/{path.lstrip('/')}"

    async def create_request(
        self, *, bound_domain: str, purpose: str
    ) -> VerificationRequestAnchor:
        """Post a Verification Request Anchor and return the QR payload.

        Raises ``NotConfiguredError`` when a path or key is missing. The request body
        carries only what the flow needs: the bound domain, the purpose and the TTL.
        """
        if not self.is_configured:
            raise NotConfiguredError(
                "Veriox (base URL, API key or request path missing)",
                operation="create_verification_request",
            )

        nonce = new_nonce()
        expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=self._settings.VERIOX_REQUEST_TTL_SECONDS
        )
        payload = {
            "domain": bound_domain,
            "purpose": purpose,
            "nonce": nonce,
            "expiresAt": expires_at.isoformat(),
        }

        async def call() -> dict:
            async with httpx.AsyncClient(
                timeout=self._settings.CONCORDIUM_REQUEST_TIMEOUT_SECONDS
            ) as client:
                response = await client.post(
                    self._url(self._settings.VERIOX_REQUEST_PATH),
                    headers=self._headers(),
                    json=payload,
                )
                response.raise_for_status()
                return response.json()

        body = await self._guard.call("veriox_create_request", call)
        qr_payload = body.get("qr") or body.get("qrPayload") or body.get("qr_payload")
        anchor_ref = body.get("anchorRef") or body.get("anchor_reference")
        if not qr_payload:
            raise DependencyUnavailableError(
                "veriox",
                "veriox request returned no QR payload (layer=http_client)",
                operation="create_verification_request",
                external_message=(
                    "The identity service did not return a code to scan. Try again in a "
                    "moment, or continue without verification for now."
                ),
            )
        return VerificationRequestAnchor(
            nonce=str(body.get("nonce") or nonce),
            bound_domain=bound_domain,
            purpose=purpose,
            expires_at=expires_at,
            qr_payload=str(qr_payload),
            request_anchor_ref=str(anchor_ref) if anchor_ref else None,
            is_configured=True,
        )

    async def check_outcome(self, *, nonce: str, bound_domain: str) -> VerificationOutcome:
        """Ask Veriox whether the proof for this nonce was accepted.

        The answer is a true-or-false verification plus an audit anchor reference.
        Anything other than a clear boolean is reported as ``pending``, never as a
        success: only an explicit true grants a badge.
        """
        if not self.is_configured:
            raise NotConfiguredError(
                "Veriox (base URL, API key or status path missing)",
                operation="check_verification",
            )

        async def call() -> dict:
            async with httpx.AsyncClient(
                timeout=self._settings.CONCORDIUM_REQUEST_TIMEOUT_SECONDS
            ) as client:
                response = await client.get(
                    self._url(self._settings.VERIOX_STATUS_PATH),
                    headers=self._headers(),
                    params={"nonce": nonce, "domain": bound_domain},
                )
                response.raise_for_status()
                return response.json()

        body = await self._guard.call("veriox_check_status", call)
        verdict = body.get("verified")
        proof_ref = body.get("proofRef") or body.get("proof_reference")
        audit_ref = body.get("auditAnchorRef") or body.get("audit_anchor_reference")

        if verdict is True:
            return VerificationOutcome(
                verified=True,
                status="approved",
                proof_reference=str(proof_ref) if proof_ref else None,
                audit_anchor_ref=str(audit_ref) if audit_ref else None,
                detail="The identity was verified with a zero-knowledge proof.",
                raw=body,
            )
        if verdict is False:
            return VerificationOutcome(
                verified=False,
                status="rejected",
                proof_reference=None,
                audit_anchor_ref=str(audit_ref) if audit_ref else None,
                detail="The identity service did not accept the proof.",
                raw=body,
            )
        return VerificationOutcome(
            verified=None,
            status="pending",
            proof_reference=None,
            audit_anchor_ref=None,
            detail=(
                "The identity service has not decided yet. Scan the code again, or wait "
                "a moment."
            ),
            raw=body,
        )


def build_identity_adapter(settings: Settings, guard: DependencyGuard) -> IdentityAdapter:
    """Choose the adapter. Veriox when it is configured, the stub otherwise.

    Deciding here rather than inside a service means the rest of the application has
    one code path, and the choice is visible in the composition root.
    """
    adapter = VerioxIdentityAdapter(settings, guard)
    if adapter.is_configured:
        return adapter
    return StubIdentityAdapter()
