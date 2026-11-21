"""Client-side spending limits for an agent, until protocol locks are usable.

The Concordium protocol can lock an account's spending at the protocol level, but that
is DevNet only for now. The hackathon workaround, which the workshop recommends and
this module implements, is three controls around a dedicated low-balance account:

1. **Isolation.** The agent pays from its own account, never from the person's. The
   account address lives on the agent identity, so the two are separate rows.
2. **Per-payment and daily caps.** Enforced here, before a payment requirement is ever
   created, and again when one is settled.
3. **Recipient allowlist.** Deny by default: an empty allowlist means the agent may pay
   nobody. This is the control that turns a stolen key into a nuisance rather than a
   loss.

The interface is deliberately the same shape a protocol lock would take, so replacing
``check_payment`` with a call into the account's on-chain lock is a change in this file
and nowhere else. When protocol locks reach mainnet, delete the caps and keep the
function signature.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal

from ..core.config import Settings
from ..core.logging import get_logger

logger = get_logger("agent.spending")

#: Why a payment was refused. Each maps to one sentence in the interface.
DENIAL_REASONS = {
    "no_agent_account": (
        "This agent does not have its own account yet, so it cannot pay for anything."
    ),
    "recipient_not_allowed": (
        "That provider is not on this agent's approved list, so the agent will not pay them."
    ),
    "above_per_payment_cap": (
        "That amount is above the agent's single-payment limit. Approve it yourself, or raise the limit."
    ),
    "above_daily_cap": (
        "The agent has reached its spending limit for today. Try again tomorrow, or approve this payment yourself."
    ),
    "human_approval_required": (
        "This payment needs your approval before the agent can start it."
    ),
    "amount_not_positive": "A payment has to be for more than zero.",
}


@dataclass(frozen=True)
class SpendDecision:
    """Whether the agent may start this payment, and why not when it may not."""

    allowed: bool
    reason: str
    detail: str


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


class AgentSpendingPolicy:
    """The caps and the allowlist, applied before anything is sent.

    ``spent_today`` is supplied by the caller, which counts it in one query over the
    receipts, so this class stays pure and testable without a database.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def per_payment_cap(self) -> float:
        return self._settings.AGENT_SPEND_PER_PAYMENT_LIMIT

    @property
    def daily_cap(self) -> float:
        return self._settings.AGENT_SPEND_DAILY_LIMIT

    @property
    def requires_human_approval(self) -> bool:
        return self._settings.AGENT_REQUIRES_HUMAN_APPROVAL

    def is_recipient_allowed(self, recipient_account: str | None) -> bool:
        """Deny by default: an unknown or empty recipient is not approved."""
        if not recipient_account:
            return False
        return recipient_account in self._settings.agent_recipient_allowlist

    def check_payment(
        self,
        *,
        agent_account: str | None,
        recipient_account: str | None,
        amount: float | Decimal,
        spent_today: float,
    ) -> SpendDecision:
        """Decide whether the agent may start one payment.

        Checks run cheapest first and every refusal carries the sentence a person
        reads. ``spent_today`` plus this amount is compared against the daily cap, so a
        burst of small payments cannot exceed it either.
        """
        amount_value = float(amount)

        if amount_value <= 0:
            return SpendDecision(False, "amount_not_positive", DENIAL_REASONS["amount_not_positive"])
        if not agent_account:
            return SpendDecision(False, "no_agent_account", DENIAL_REASONS["no_agent_account"])
        if not self.is_recipient_allowed(recipient_account):
            return SpendDecision(
                False, "recipient_not_allowed", DENIAL_REASONS["recipient_not_allowed"]
            )
        if amount_value > self.per_payment_cap:
            return SpendDecision(
                False, "above_per_payment_cap", DENIAL_REASONS["above_per_payment_cap"]
            )
        if spent_today + amount_value > self.daily_cap:
            return SpendDecision(False, "above_daily_cap", DENIAL_REASONS["above_daily_cap"])

        logger.info(
            "agent payment allowed",
            extra={
                "operation": "check_agent_payment",
                "amount": amount_value,
                "spent_today": spent_today,
                "per_payment_cap": self.per_payment_cap,
                "daily_cap": self.daily_cap,
            },
        )
        return SpendDecision(True, "allowed", "")

    def describe_limits(self) -> dict[str, object]:
        """The limits, for the agent card and the profile page."""
        return {
            "per_payment_cap": self.per_payment_cap,
            "daily_cap": self.daily_cap,
            "recipient_allowlist": self._settings.agent_recipient_allowlist,
            "requires_human_approval": self.requires_human_approval,
            "enforced_by": "client-side until protocol-level locks are available on mainnet",
        }
