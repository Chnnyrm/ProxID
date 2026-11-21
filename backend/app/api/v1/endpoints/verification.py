"""Proof-of-personhood routes: request, scan, approve.

The three steps are deliberately separate endpoints. A single endpoint that did all of
them would hide the moment consent happens, and consent is the thing the product is
about.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....schemas.verification import (
    ApprovalOut,
    VerificationApproveIn,
    VerificationOut,
    VerificationRequestIn,
)
from ...deps import CurrentUser, get_container, get_current_user, get_db

router = APIRouter()


@router.post("/request", response_model=VerificationOut, status_code=status.HTTP_201_CREATED)
async def request_verification(
    payload: VerificationRequestIn,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> VerificationOut:
    """Create a single-use, domain-bound verification request and its QR.

    While the Veriox adapter is unconfigured the request is still created, with a real
    nonce and expiry and a null QR and anchor reference, so the flow is visible without
    anything being faked.
    """
    view = await container.verification.request_verification(
        db, current_user, purpose=payload.purpose
    )
    return VerificationOut(
        nonce=view.nonce,
        purpose=view.purpose,
        bound_domain=view.bound_domain,
        status=view.status,
        qr_payload=view.qr_payload,
        request_anchor_ref=view.request_anchor_ref,
        audit_anchor_ref=view.audit_anchor_ref,
        expires_at=view.expires_at,
        is_demo=view.is_demo,
        configured=view.configured,
        message=view.message,
    )


@router.post("/approve", response_model=ApprovalOut)
async def approve_verification(
    payload: VerificationApproveIn,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApprovalOut:
    """Check whether the person approved in the ID app, and grant the badge if so.

    The badge is granted here and nowhere else, and only on an explicit verified
    answer from the verifier.
    """
    result = await container.verification.approve(db, current_user, nonce=payload.nonce)
    return ApprovalOut(
        status=result.status,
        verified=result.verified,
        message=result.message,
        proof_reference=result.proof_reference,
        audit_anchor_ref=result.audit_anchor_ref,
    )


@router.get("/me", response_model=VerificationOut | None)
async def my_verification(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> VerificationOut | None:
    """The caller's latest verification attempt, or nothing when there was none."""
    request = await container.verification.latest_for_user(db, current_user)
    if request is None:
        return None
    return VerificationOut(
        nonce=request.nonce,
        purpose=request.purpose,
        bound_domain=request.bound_domain,
        status=request.status,
        qr_payload=request.qr_payload,
        request_anchor_ref=request.request_anchor_ref,
        audit_anchor_ref=request.audit_anchor_ref,
        expires_at=request.expires_at,
        is_demo=request.is_demo,
        configured=container.verification.is_configured,
        message="The latest verification request on this account.",
    )
