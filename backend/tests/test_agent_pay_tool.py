"""Tests for the agent's pay_for_service tool.

Verifies:
- Requires user consent before executing on-chain payment.
- Enforces spending policy caps and recipient allowlist.
- Summarises payment steps accurately for the agent thread.
"""

from __future__ import annotations

import pytest

from app.core.config import Settings
from app.services.agent_tools import (
    ToolContext,
    _tool_pay_for_service,
    summarise_step,
    tool_names,
)
from app.services.spending_policy import AgentSpendingPolicy


def test_pay_for_service_tool_is_registered() -> None:
    """The pay_for_service tool must be present in the tool table."""
    assert "pay_for_service" in tool_names()


@pytest.mark.asyncio
async def test_pay_for_service_requires_consent_first() -> None:
    """Without consent=True, tool refuses to spend and prompts for confirmation."""
    # Build minimal mock context
    class MockPayments:
        _settings = Settings(
            APP_ENV="test",
            SECRET_KEY="test-only-secret-key-that-is-long-enough-32",
            CONCORDIUM_X402_MERCHANT_ACCOUNT="3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW",
        )
        _spending = AgentSpendingPolicy(_settings)

    class MockUser:
        id = "441ef61b-5040-5abe-a679-5080ef6eaa68"
        agent_account_address = "demo-agent-account-ada"

    class MockDb:
        async def execute(self, *args, **kwargs):
            class MockRes:
                def scalar_one_or_none(self):
                    return None
            return MockRes()

    context = ToolContext(
        db=MockDb(),
        user=MockUser(),
        jobs=None,
        listings=None,
        messages=None,
        payments=MockPayments(),
        users=None,
        spending=MockPayments._spending,
    )

    result = await _tool_pay_for_service(
        context,
        {"amount": 1.0, "recipient_account": "3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW"},
    )
    assert result["ok"] is False
    assert result["requires_consent"] is True
    assert result["status"] == "consent_required"
    assert "consent" in result["message"].lower()


@pytest.mark.asyncio
async def test_pay_for_service_enforces_spending_caps() -> None:
    """Payments exceeding per-payment cap are refused by spending policy."""
    settings = Settings(
        APP_ENV="test",
        SECRET_KEY="test-only-secret-key-that-is-long-enough-32",
        AGENT_SPEND_PER_PAYMENT_LIMIT=50.0,
        AGENT_RECIPIENT_ALLOWLIST="3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW",
    )
    spending = AgentSpendingPolicy(settings)

    class MockPayments:
        _settings = settings
        _spending = spending

    class MockUser:
        id = "441ef61b-5040-5abe-a679-5080ef6eaa68"
        agent_account_address = "demo-agent-account-ada"

    class MockDb:
        async def execute(self, *args, **kwargs):
            class MockRes:
                def scalar_one_or_none(self):
                    return None
                def scalar_one(self):
                    return 0
            return MockRes()

    context = ToolContext(
        db=MockDb(),
        user=MockUser(),
        jobs=None,
        listings=None,
        messages=None,
        payments=MockPayments(),
        users=None,
        spending=spending,
    )

    result = await _tool_pay_for_service(
        context,
        {
            "amount": 100.0,
            "recipient_account": "3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW",
            "consent": True,
        },
    )
    assert result["ok"] is False
    assert result["status"] == "refused_by_policy"
    assert result["reason"] == "above_per_payment_cap"


def test_summarise_step_for_pay_for_service() -> None:
    """Summaries reflect consent requests and completed settlements."""
    summary_consent = summarise_step(
        "pay_for_service",
        {"requires_consent": True, "amount": 2.5},
    )
    assert "requested approval" in summary_consent
    assert "2.5" in summary_consent

    summary_settled = summarise_step(
        "pay_for_service",
        {"tx_hash": "a1b2c3d4e5f60718293a", "amount": 1.0},
    )
    assert "settled payment" in summary_settled
    assert "a1b2c3d4e5" in summary_settled
