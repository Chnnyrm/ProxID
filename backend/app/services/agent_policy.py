"""Autonomy policy: the single source of truth for what the agent may do alone.

Ported from Gigr's ``agent_policy.py`` minus the guardrail counter that queried
``AgentTask.params``. The levels, the capabilities they grant and the fail-safe
default are unchanged, because they are a product decision rather than an
implementation detail:

    off     nothing happens without an explicit command
    low     reply to incoming messages
    medium  + negotiate a price on the user's behalf
    high    + reach out about matching jobs
    total   + look for work the user did not ask about

An unknown level resolves to ``off``. A level that cannot be parsed must never
grant a capability.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..core.logging import get_logger

logger = get_logger("agent.policy")

#: The five levels, in order of increasing autonomy.
LEVELS = ("off", "low", "medium", "high", "total")

#: Rolling window for the per-day counters.
GUARDRAIL_WINDOW_HOURS = 24


@dataclass(frozen=True)
class AutonomyPolicy:
    """Resolved capabilities for one person at one level."""

    level: str
    can_auto_reply: bool
    can_negotiate: bool
    can_reach_out: bool
    can_proactive_hunt: bool
    daily_action_cap: int

    @property
    def is_autonomous(self) -> bool:
        """True for every level except ``off``."""
        return self.level != "off"


#: index -> (daily autonomous actions, capabilities)
_LIMITS: dict[int, int] = {0: 0, 1: 20, 2: 30, 3: 40, 4: 60}


def policy_for_level(level: Any) -> AutonomyPolicy:
    """Resolve a raw level string into capabilities.

    Unknown, empty or non-string input resolves to ``off`` and logs the rejection,
    which is the fail-safe direction: a broken setting must not loosen the agent.
    """
    normalised = str(level or "off").strip().lower()
    if normalised not in LEVELS:
        logger.warning(
            "unknown autonomy level, treating as off",
            extra={"operation": "policy_for_level", "level": normalised},
        )
        normalised = "off"
    rank = LEVELS.index(normalised)
    return AutonomyPolicy(
        level=normalised,
        can_auto_reply=rank >= 1,
        can_negotiate=rank >= 2,
        can_reach_out=rank >= 3,
        can_proactive_hunt=rank >= 4,
        daily_action_cap=_LIMITS[rank],
    )


def resolve_policy(autonomy_level: str | None) -> AutonomyPolicy:
    """Resolve the policy from the stored level on a user row."""
    return policy_for_level(autonomy_level)


def within_guardrails(policy: AutonomyPolicy, *, feature: str, used_today: int) -> bool:
    """Whether the policy still has budget for ``feature`` today.

    ``used_today`` is supplied by the caller, which counts it in one query; this
    function is pure so the rule can be tested without a database.
    """
    if policy.daily_action_cap <= 0:
        return False
    if feature == "reach_out" and not policy.can_reach_out:
        return False
    if used_today >= policy.daily_action_cap:
        logger.info(
            "agent guardrail reached",
            extra={
                "operation": "within_guardrails",
                "feature": feature,
                "level": policy.level,
                "used": used_today,
                "cap": policy.daily_action_cap,
            },
        )
        return False
    return True
