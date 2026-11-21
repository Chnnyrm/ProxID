"""The audit trail, built for EU AI Act Article 12 without storing anything on chain.

The pattern the Concordium workshop describes, and the one this module implements:

- The record is kept off chain, in ``audit_events``, with a random per-record nonce.
- The payload is canonicalised and hashed together with that nonce.
- Only the hash is anchored, with a ``registerData`` transaction.
- Delete the off-chain row later and the nonce is gone, so the on-chain hash can never
  be matched back to a payload. That is what makes erasure real: the chain keeps a
  proof that something happened, without keeping the something.

Two rules that are enforced in code rather than in a comment:

1. **Append-only.** There is no update and no delete here. A correction is a new
   record, never a rewrite. ``record`` is the only writer.
2. **No raw personal data.** Detail is filtered through an allowlist of structural
   fields. Anything free-form (a message body, a prompt, a model output) is stored as
   a length and a truncated SHA-256, never as text. A name or an email address never
   reaches the hash input, so it cannot reach the chain.

``anchor_pending`` raises ``NotConfiguredError``: the registry contract address is
known, but no node endpoint has been issued, so nothing is anchored and no reference
is invented.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import Settings
from ...core.errors import NotConfiguredError
from ...core.logging import correlation_id_var, get_logger
from ...crud import audit_event as audit_crud
from ...models.audit_event import AuditEvent

logger = get_logger("audit")

#: The complete set of audited actions. Kept here so a typo in a call site is a review
#: comment rather than a silently new event name in the database.
AUDIT_ACTIONS = (
    "register_user",
    "login_user",
    "google_sign_in",
    "demo_login",
    "logout",
    "update_profile",
    "create_listing",
    "update_listing",
    "set_listing_active",
    "post_job",
    "assign_provider",
    "accept_job",
    "start_job",
    "complete_job",
    "cancel_job",
    "dispute_job",
    "send_message",
    "run_agent",
    "initiate_x402_payment",
    "settle_x402_payment",
    "request_verification",
    "approve_verification",
    "register_agent",
)

#: Detail keys that may be stored as-is. Everything else is reduced to a hash.
#: These are identifiers, enums and numbers: structural, not personal.
PII_SAFE_FIELDS = frozenset(
    {
        "amount",
        "author_kind",
        "currency",
        "degraded",
        "demo",
        "from_status",
        "job_id",
        "length",
        "level",
        "provider_id",
        "received",
        "sender",
        "settled",
        "status",
        "step_count",
        "to_status",
        "tool",
        "tools",
        "verified",
        "configured",
    }
)

#: Free-form fields that must never be stored, even hashed under their own name.
#: Listed explicitly so the intent is reviewable.
FORBIDDEN_FIELDS = frozenset(
    {"body", "prompt", "output", "completion", "email", "name", "display_name", "address"}
)


@dataclass(frozen=True)
class AnchorResult:
    """What a chain anchor of the audit trail would report."""

    anchored: int
    batch_reference: str


def new_nonce() -> str:
    """A random 128-bit nonce, hex. Unique per record and never reused."""
    return secrets.token_hex(16)


def canonicalise(payload: dict) -> str:
    """A stable JSON rendering: sorted keys, no whitespace, UTF-8 safe."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def payload_hash(nonce: str, payload: dict) -> str:
    """SHA-256 over the nonce and the canonical payload.

    The nonce is first so two identical events produce different hashes, which is what
    stops the chain from becoming a lookup table of known events.
    """
    digest = hashlib.sha256()
    digest.update(nonce.encode("utf-8"))
    digest.update(b"\x00")
    digest.update(canonicalise(payload).encode("utf-8"))
    return digest.hexdigest()


def reduce_text(value: str) -> dict[str, object]:
    """A free-form string as a length and a hash prefix, never as text.

    This is what a message body or a model output becomes before it can reach the hash
    input. 16 hex characters is enough to correlate two records without being a
    reversible fingerprint of a short string.
    """
    return {
        "text_length": len(value),
        "text_digest": hashlib.sha256(value.encode("utf-8")).hexdigest()[:16],
    }


def safe_detail(detail: dict | None) -> dict[str, object]:
    """Filter a detail mapping down to what may be hashed and stored.

    Allowed keys pass through. Forbidden keys are dropped entirely, not even hashed
    under their own name: an email address keyed as "email" must not appear at all.
    Any other string is reduced with ``reduce_text``.
    """
    if not detail:
        return {}
    safe: dict[str, object] = {}
    for key, value in detail.items():
        if key in FORBIDDEN_FIELDS:
            continue
        if key in PII_SAFE_FIELDS:
            if isinstance(value, (int, float, bool)) or value is None:
                safe[key] = value
            elif isinstance(value, str):
                safe[key] = value[:64]
            elif isinstance(value, (list, tuple)):
                safe[key] = [str(item)[:32] for item in value][:20]
            else:
                safe[key] = str(value)[:64]
            continue
        if isinstance(value, str):
            safe[key] = reduce_text(value)
        elif isinstance(value, (int, float, bool)) or value is None:
            safe[key] = value
        else:
            safe[key] = reduce_text(canonicalise({"value": value}))
    return safe


class AuditService:
    """Writes the audit trail, and refuses to invent an on-chain anchor."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def record(
        self,
        db: AsyncSession,
        *,
        action: str,
        subject_type: str,
        outcome: str,
        subject_id: str | None = None,
        actor_id: uuid.UUID | None = None,
        detail: dict | None = None,
        client_ip: str | None = None,
    ) -> AuditEvent:
        """Append one audit row.

        ``action`` must be one of ``AUDIT_ACTIONS``: a trail with invented action names
        cannot be queried. The row carries a fresh nonce and the hash of everything that
        would be anchored, so anchoring later needs nothing but the hash.

        The client IP is hashed before storage: it is personal data, and the audit needs
        only to distinguish two callers, not to name them.
        """
        if action not in AUDIT_ACTIONS:
            raise ValueError(f"unknown audit action {action!r}; add it to AUDIT_ACTIONS")

        nonce = new_nonce()
        payload = {
            "action": action,
            "subject_type": subject_type,
            "subject_id": subject_id,
            "outcome": outcome,
            "actor_id": str(actor_id) if actor_id else None,
            "detail": safe_detail(detail),
            "correlation_id": correlation_id_var.get(),
        }
        return await audit_crud.create(
            db,
            action=action,
            subject_type=subject_type,
            outcome=outcome,
            subject_id=subject_id,
            actor_id=actor_id,
            detail=safe_detail(detail),
            correlation_id=correlation_id_var.get(),
            client_ip=hashlib.sha256((client_ip or "").encode("utf-8")).hexdigest()[:32] if client_ip else None,
            record_nonce=nonce,
            payload_hash=payload_hash(nonce, payload),
        )

    async def anchor_pending(self, db: AsyncSession, *, limit: int = 100) -> AnchorResult:
        """Anchor the hashes of recent unanchored records with ``registerData``.

        Not configured: the registry address is known but no node endpoint has been
        issued, so no transaction can be written. Raises rather than returning a
        fabricated reference.
        """
        if not self._settings.CONCORDIUM_NODE_ENDPOINT:
            raise NotConfiguredError(
                "the Concordium audit registry (no node endpoint)", operation="anchor_audit_batch"
            )
        raise NotConfiguredError(
            "the Concordium audit registry", operation="anchor_audit_batch"
        )

    async def anchor_hash(self, payload_digest: str) -> str:
        """Write one hash on chain and return the transaction reference.

        This is the only function that would ever put anything from ProxID on chain, and
        its input is a hex digest: no name, no message, no prompt, no output.
        """
        raise NotConfiguredError("the Concordium audit registry", operation="anchor_audit_hash")
