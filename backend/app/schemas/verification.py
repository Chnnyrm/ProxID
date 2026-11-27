"""Verification contracts: the request, the QR, and the answer."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from .base import InputModel, OutputModel


class VerificationRequestIn(InputModel):
    """Ask for a proof of personhood, or of age."""

    purpose: Literal["personhood", "age_over_18"] = "personhood"


class VerificationApproveIn(InputModel):
    """Report that consent came back for one request."""

    nonce: str = Field(min_length=8, max_length=64)
    status: Literal["approved", "refused", "cancelled"] = "approved"
    reason: str | None = None
    proof_reference: str | None = None


class VerificationOut(OutputModel):
    """One verification attempt, as the profile page shows it."""

    nonce: str
    purpose: str
    bound_domain: str
    status: str
    qr_payload: str | None = None
    request_anchor_ref: str | None = None
    audit_anchor_ref: str | None = None
    expires_at: datetime
    is_demo: bool
    configured: bool
    message: str


class ApprovalOut(OutputModel):
    """What happened when consent was checked."""

    status: str
    verified: bool
    message: str
    proof_reference: str | None = None
    audit_anchor_ref: str | None = None
