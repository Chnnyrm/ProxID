"""Tests for Concordium verification flow: schemas, outcome recording, status transitions, and config bindings."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
import pytest
from app.core.config import Settings
from app.models.user import User
from app.schemas.verification import (
    ApprovalOut,
    VerificationApproveIn,
    VerificationOut,
    VerificationRequestIn,
)
from app.services.concordium.identity_service import (
    ConcordiumIdentityAdapter,
    StubIdentityAdapter,
    VerificationOutcome,
    VerificationRequestAnchor,
    build_identity_adapter,
)
from app.services.verification_service import VerificationService


def test_verification_schemas() -> None:
    # 1. VerificationApproveIn supports approved, refused, and cancelled
    approved = VerificationApproveIn(nonce="test_nonce_123456", status="approved", proof_reference="zkp_ref_1")
    assert approved.status == "approved"
    assert approved.proof_reference == "zkp_ref_1"

    refused = VerificationApproveIn(nonce="test_nonce_123456", status="refused", reason="User declined in wallet")
    assert refused.status == "refused"
    assert refused.reason == "User declined in wallet"

    cancelled = VerificationApproveIn(nonce="test_nonce_123456", status="cancelled", reason="Window closed")
    assert cancelled.status == "cancelled"

    # 2. VerificationRequestIn
    req = VerificationRequestIn(purpose="personhood")
    assert req.purpose == "personhood"


def test_concordium_bound_domain_config() -> None:
    settings = Settings(
        APP_ENV="test",
        SECRET_KEY="test-only-secret-key-that-is-long-enough-32",
        CONCORDIUM_BOUND_DOMAIN="proxid-psi.vercel.app",
    )
    assert settings.CONCORDIUM_BOUND_DOMAIN == "proxid-psi.vercel.app"
    # Backwards compatibility alias
    assert settings.VERIOX_BOUND_DOMAIN == "proxid-psi.vercel.app"
    assert settings.concordium_configured is True


def test_identity_adapter_selection() -> None:
    settings = Settings(
        APP_ENV="test",
        SECRET_KEY="test-only-secret-key-that-is-long-enough-32",
    )
    guard = MagicMock()
    adapter = build_identity_adapter(settings, guard)
    assert isinstance(adapter, StubIdentityAdapter)
    assert adapter.is_configured is False


@pytest.mark.asyncio
async def test_verification_service_approve_and_refuse() -> None:
    settings = Settings(
        APP_ENV="test",
        SECRET_KEY="test-only-secret-key-that-is-long-enough-32",
        CONCORDIUM_BOUND_DOMAIN="proxid-psi.vercel.app",
    )
    audit = MagicMock()
    audit.record = AsyncMock()
    adapter = StubIdentityAdapter()

    service = VerificationService(settings=settings, audit=audit, adapter=adapter)

    mock_user = MagicMock(spec=User)
    mock_user.id = 42
    mock_user.concordium_verified = False
    mock_user.is_demo = False

    # Mock db and crud
    mock_db = AsyncMock()
    mock_request = MagicMock()
    mock_request.user_id = 42
    mock_request.status = "pending"
    mock_request.purpose = "personhood"
    mock_request.bound_domain = "proxid-psi.vercel.app"

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.services.verification_service.request_crud.get_by_nonce", AsyncMock(return_value=mock_request))
        mp.setattr("app.services.verification_service.request_crud.consume", AsyncMock(return_value=True))
        mp.setattr("app.services.verification_service.request_crud.record_outcome", AsyncMock())
        mp.setattr("app.services.verification_service.user_crud.set_concordium_verification", AsyncMock())

        # Test status='refused'
        result_refused = await service.approve(
            mock_db,
            mock_user,
            nonce="nonce_refused_12345",
            status="refused",
            reason="Wallet cancelled by user",
        )
        assert result_refused.status == "refused"
        assert result_refused.verified is False
        assert "Wallet cancelled by user" in result_refused.message
        assert mock_user.concordium_verified is False

        # Test status='approved'
        result_approved = await service.approve(
            mock_db,
            mock_user,
            nonce="nonce_approved_12345",
            status="approved",
            proof_reference="ccd_zkp_ref_valid",
        )
        assert result_approved.status == "approved"
        assert result_approved.verified is True
        assert result_approved.proof_reference == "ccd_zkp_ref_valid"
