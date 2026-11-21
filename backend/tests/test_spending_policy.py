"""The client-side limits that isolate an agent until protocol locks exist.

Protocol-level account locks are DevNet only, so these caps and this allowlist are the
isolation. Each test names the loss it prevents.
"""

from __future__ import annotations

from app.core.config import Settings
from app.services.spending_policy import AgentSpendingPolicy


def policy(**overrides) -> AgentSpendingPolicy:
    """A policy with a two-recipient allowlist and small caps, easy to reason about."""
    base = dict(
        AGENT_SPEND_PER_PAYMENT_LIMIT=5000.0,
        AGENT_SPEND_DAILY_LIMIT=8000.0,
        AGENT_RECIPIENT_ALLOWLIST="demo-human-account-northgate,demo-human-account-amaka",
    )
    base.update(overrides)
    return AgentSpendingPolicy(Settings(**base))


def test_an_empty_allowlist_permits_nobody() -> None:
    """Deny by default. A deployment that forgot the allowlist must not pay anyone."""
    strict = policy(AGENT_RECIPIENT_ALLOWLIST="")
    decision = strict.check_payment(
        agent_account="demo-agent-account-ada",
        recipient_account="demo-human-account-northgate",
        amount=100.0,
        spent_today=0.0,
    )
    assert decision.allowed is False
    assert decision.reason == "recipient_not_allowed"


def test_a_recipient_outside_the_allowlist_is_refused() -> None:
    """The control that turns a stolen key into a nuisance rather than a loss."""
    decision = policy().check_payment(
        agent_account="demo-agent-account-ada",
        recipient_account="demo-human-account-stranger",
        amount=100.0,
        spent_today=0.0,
    )
    assert decision.allowed is False
    assert "approved list" in decision.detail


def test_a_payment_above_the_per_payment_cap_is_refused() -> None:
    """A single large transfer is the worst case; the cap is checked before anything else."""
    decision = policy().check_payment(
        agent_account="demo-agent-account-ada",
        recipient_account="demo-human-account-northgate",
        amount=5001.0,
        spent_today=0.0,
    )
    assert decision.allowed is False
    assert decision.reason == "above_per_payment_cap"


def test_a_burst_of_small_payments_cannot_exceed_the_daily_cap() -> None:
    """Spent-today plus this amount is compared, not this amount alone."""
    decision = policy().check_payment(
        agent_account="demo-agent-account-ada",
        recipient_account="demo-human-account-northgate",
        amount=4000.0,
        spent_today=5000.0,
    )
    assert decision.allowed is False
    assert decision.reason == "above_daily_cap"


def test_an_agent_without_its_own_account_cannot_pay() -> None:
    """An agent that borrows the human's account is the thing the design forbids."""
    decision = policy().check_payment(
        agent_account=None,
        recipient_account="demo-human-account-northgate",
        amount=100.0,
        spent_today=0.0,
    )
    assert decision.allowed is False
    assert decision.reason == "no_agent_account"


def test_a_zero_amount_is_refused() -> None:
    """A zero payment is not a payment, and it would still cost gas."""
    decision = policy().check_payment(
        agent_account="demo-agent-account-ada",
        recipient_account="demo-human-account-northgate",
        amount=0.0,
        spent_today=0.0,
    )
    assert decision.allowed is False
    assert decision.reason == "amount_not_positive"


def test_an_allowed_payment_inside_every_limit_passes() -> None:
    """The happy path, so the refusals above are not a policy that refuses everything."""
    decision = policy().check_payment(
        agent_account="demo-agent-account-ada",
        recipient_account="demo-human-account-amaka",
        amount=4500.0,
        spent_today=3000.0,
    )
    assert decision.allowed is True
    assert decision.detail == ""


def test_the_described_limits_say_they_are_client_side() -> None:
    """A reader must not believe the lock is on chain yet."""
    described = policy().describe_limits()
    assert "protocol-level locks" in str(described["enforced_by"])
    assert described["recipient_allowlist"] == [
        "demo-human-account-northgate",
        "demo-human-account-amaka",
    ]
