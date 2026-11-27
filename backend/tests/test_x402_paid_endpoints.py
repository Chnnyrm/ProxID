"""Tests for x402 paid routes: /quote and /protected-resource.

Verifies:
- POST /api/v1/payments/quote returns exact requirements with feePayer from facilitator /supported.
- GET and POST /api/v1/payments/protected-resource without payment header returns HTTP 402 with requirements.
- Submissions with invalid payload report errorReason.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def app_client() -> TestClient:
    settings = Settings(
        APP_ENV="test",
        SECRET_KEY="test-only-secret-key-that-is-long-enough-32",
        FEATURE_X402_PAYMENTS=True,
        CONCORDIUM_X402_MERCHANT_ACCOUNT="3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW",
        X402_SPONSOR_ADDRESS="3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW",
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def test_quote_endpoint_returns_exact_requirements() -> None:
    """POST /api/v1/payments/quote returns scheme, network, payTo, amount, asset, extra.feePayer."""
    with app_client() as client:
        response = client.post("/api/v1/payments/quote", json={"amount": "2000000"})
        assert response.status_code == 200
        data = response.json()
        assert data["scheme"] == "exact"
        assert data["network"] == "ccd:4221332d34e1694168c2a0c0b3fd0f27"
        assert data["amount"] == "2000000"
        assert data["asset"] == "CCD"
        assert "feePayer" in data["extra"]
        assert len(data["payTo"]) > 0


def test_protected_resource_returns_402_without_payment_header() -> None:
    """Unauthenticated or unpaid request returns HTTP 402 with required payment parameters."""
    with app_client() as client:
        response = client.get("/api/v1/payments/protected-resource")
        assert response.status_code == 402
        data = response.json()
        assert data["error"] == "Payment Required"
        assert data["scheme"] == "exact"
        assert data["network"] == "ccd:4221332d34e1694168c2a0c0b3fd0f27"
        assert data["asset"] == "CCD"
        assert "feePayer" in data["extra"]
        assert "payTo" in data
        assert "amount" in data
        assert "Payment-Required" in response.headers


def test_protected_resource_returns_error_reason_on_invalid_payment() -> None:
    """A malformed or refused payment returns facilitator errorReason verbatim."""
    with app_client() as client:
        response = client.post(
            "/api/v1/payments/protected-resource",
            headers={"X-PAYMENT": '{"payload": {"signedTransaction": "invalid", "sender": "4Sender"}}'},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "errorReason" in data

