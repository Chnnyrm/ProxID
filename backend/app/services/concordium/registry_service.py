"""Agent registration and the five-point card check.

An agent is a first-class participant: it needs an identity a client can look up, a
card describing what it does, and a way to prove the card it is showing is the card
that was registered.

The standard is documented as CIS-8004 (the workshops say CIS-804; the documented
name is used in code comments and kept out of user-facing copy until confirmed). The
verified testnet registry contract is ``12802,0``.

Registration is not configured: the registry address is known, but no node endpoint
and no agent account have been issued, so nothing is registered and no id is invented.

The verifier is real and testable. It performs the five checks the workshop lists:

  1. the registry address is the official one
  2. the agent's status is Active
  3. the live card URL matches the registered URL
  4. the hash of the fetched card matches the on-chain hash
  5. the owner in the card matches the NFT owner

and it re-verifies rather than caching a verdict, because an owner can revoke.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any

from ...core.config import Settings
from ...core.errors import NotConfiguredError
from ...core.logging import get_logger
from ...core.resilience import DependencyGuard

logger = get_logger("concordium.registry")

#: The documented standard name, kept in code only. Never rendered to a person until
#: the naming question (CIS-804 versus CIS-8004) is confirmed against the docs.
STANDARD_NAME = "CIS-8004"

#: The verified testnet registry contract. Compared against, so a wrong address is a
#: failed check rather than a silent registration on an unknown contract.
OFFICIAL_TESTNET_REGISTRY = "12802,0"

#: The extension block the card must carry, under capabilities.extensions.
BADGE_EXTENSION_KEY = "concordium-badge"
BADGE_EXTENSION_VERSION = "v1"


@dataclass(frozen=True)
class AgentCard:
    """The card an agent publishes. Hashable, so the on-chain hash can be checked."""

    name: str
    description: str
    account_address: str | None
    owner_account: str | None
    tools: list[str]
    card_url: str
    version: str = BADGE_EXTENSION_VERSION

    def to_payload(self) -> dict[str, Any]:
        """The card as JSON, with the badge extension in place.

        The extension block is what a verifier looks for first: it says which badge
        contract vouched for this agent, and at which version.
        """
        return {
            "name": self.name,
            "description": self.description,
            "standard": STANDARD_NAME,
            "account": self.account_address,
            "owner": self.owner_account,
            "cardUrl": self.card_url,
            "capabilities": {
                "tools": list(self.tools),
                "limits": {
                    "moves_money": False,
                    "requires_human_approval_for_payment": True,
                    "spend_isolated_account": True,
                },
                "extensions": {
                    BADGE_EXTENSION_KEY: {
                        "version": BADGE_EXTENSION_VERSION,
                        "standard": STANDARD_NAME,
                        "registry": OFFICIAL_TESTNET_REGISTRY,
                    }
                },
            },
        }

    def canonical_hash(self) -> str:
        """SHA-256 of the canonical JSON. This is what the registry stores as a hash."""
        return hashlib.sha256(
            json.dumps(self.to_payload(), sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()


@dataclass(frozen=True)
class RegistrationState:
    """What the registry says about an agent right now."""

    agent_id: str
    registry_address: str
    status: str
    card_url: str
    card_hash: str
    nft_owner: str


@dataclass(frozen=True)
class CardCheck:
    """One of the five checks."""

    name: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class CardVerification:
    """The result of all five. ``valid`` is true only when every check passed."""

    valid: bool
    checks: list[CardCheck] = field(default_factory=list)

    @property
    def failed(self) -> list[str]:
        return [check.name for check in self.checks if not check.passed]


def verify_agent_card(
    *,
    expected_registry: str,
    state: RegistrationState,
    live_card: dict[str, Any] | None,
    live_card_url: str | None,
) -> CardVerification:
    """Run the five checks against a fetched card and the registry's record.

    Every check runs, even after one fails, so the report says everything that is
    wrong. Nothing is cached: the caller fetches and verifies, because an owner can
    revoke and a cache would keep serving a badge that no longer exists.

    Worst-case input: ``live_card`` is None when the URL is unreachable, which fails
    checks 3, 4 and 5 rather than raising.
    """
    checks: list[CardCheck] = []

    # 1. The registry is the official one.
    checks.append(
        CardCheck(
            name="official_registry",
            passed=state.registry_address == expected_registry == OFFICIAL_TESTNET_REGISTRY,
            detail=(
                f"registry {state.registry_address} is the verified contract"
                if state.registry_address == OFFICIAL_TESTNET_REGISTRY
                else f"registry {state.registry_address} is not {OFFICIAL_TESTNET_REGISTRY}"
            ),
        )
    )

    # 2. The agent is Active.
    checks.append(
        CardCheck(
            name="status_active",
            passed=state.status.strip().lower() == "active",
            detail=f"status is {state.status}",
        )
    )

    # 3. The live URL is the registered URL.
    checks.append(
        CardCheck(
            name="card_url_matches",
            passed=bool(live_card_url) and live_card_url == state.card_url,
            detail=(
                "the served card is at the registered URL"
                if live_card_url == state.card_url
                else "the served card URL does not match the registered one"
            ),
        )
    )

    # 4. The fetched card hashes to the registered hash.
    actual_hash = canonical_hash_of(live_card) if live_card is not None else None
    checks.append(
        CardCheck(
            name="card_hash_matches",
            passed=actual_hash is not None and actual_hash == state.card_hash,
            detail=(
                "the fetched card hashes to the on-chain hash"
                if actual_hash is not None and actual_hash == state.card_hash
                else "the fetched card does not hash to the on-chain hash"
            ),
        )
    )

    # 5. The owner named in the card is the NFT owner.
    card_owner = (live_card or {}).get("owner")
    checks.append(
        CardCheck(
            name="owner_matches",
            passed=bool(card_owner) and card_owner == state.nft_owner,
            detail=(
                "the card owner is the NFT owner"
                if card_owner == state.nft_owner
                else "the card owner is not the NFT owner"
            ),
        )
    )

    return CardVerification(valid=all(check.passed for check in checks), checks=checks)


def canonical_hash_of(card: dict[str, Any]) -> str:
    """SHA-256 of a card as fetched, canonicalised the same way a card is generated."""
    return hashlib.sha256(
        json.dumps(card, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def build_agent_card(
    *,
    name: str,
    description: str,
    account_address: str | None,
    owner_account: str | None,
    tool_names: list[str],
    card_url: str,
) -> AgentCard:
    """Build the card this build would register.

    Local and real: it describes the tools the agent actually has and the limits it
    actually runs under, which is what the card is for. Only the registration that
    publishes it is missing.
    """
    return AgentCard(
        name=name,
        description=description,
        account_address=account_address,
        owner_account=owner_account,
        tools=list(tool_names),
        card_url=card_url,
    )


@dataclass(frozen=True)
class AgentRegistration:
    """What a registration returns once it exists."""

    agent_id: str
    agent_card_url: str
    account_address: str
    network: str


class RegistryService:
    """The boundary around the agent registry contract."""

    def __init__(self, settings: Settings, guard: DependencyGuard) -> None:
        self._settings = settings
        self._guard = guard

    @property
    def is_configured(self) -> bool:
        """True only when a registry address and a node endpoint exist."""
        return bool(
            self._settings.CONCORDIUM_AGENT_REGISTRY_ADDRESS
            and self._settings.CONCORDIUM_NODE_ENDPOINT
        )

    @property
    def expected_registry(self) -> str:
        """The registry address this deployment treats as official."""
        return self._settings.CONCORDIUM_AGENT_REGISTRY_ADDRESS

    async def register_agent(
        self, *, account_address: str, card: AgentCard
    ) -> AgentRegistration:
        """Publish a card and return its on-chain id.

        Raises ``NotConfiguredError``; no id is fabricated, because an id that does not
        resolve is worse than an honest absence.
        """
        if not self.is_configured:
            raise NotConfiguredError("the agent registry", operation="register_agent")
        raise NotConfiguredError("the agent registry", operation="register_agent")

    async def get_registration_state(self, agent_id: str) -> RegistrationState | None:
        """Read the registry's record for an agent, or None while unconfigured."""
        if not self.is_configured:
            return None
        raise NotConfiguredError("the agent registry", operation="get_agent")

    async def get_agent_card(self, agent_id: str) -> dict[str, Any] | None:
        """Read a registered agent's card, or None while unconfigured."""
        if not self.is_configured:
            return None
        raise NotConfiguredError("the agent registry", operation="get_agent_card")

    async def verify_registered_agent(
        self, *, agent_id: str, live_card: dict[str, Any] | None, live_card_url: str | None
    ) -> CardVerification:
        """Fetch the record and run the five checks.

        Returns a verification with every check failed when the registry is not
        configured, rather than raising: a page showing an unregistered agent should
        say so plainly.
        """
        state = await self.get_registration_state(agent_id)
        if state is None:
            return CardVerification(
                valid=False,
                checks=[
                    CardCheck(
                        name="registry_reachable",
                        passed=False,
                        detail="the agent registry is not connected, so nothing can be verified",
                    )
                ],
            )
        return verify_agent_card(
            expected_registry=self.expected_registry,
            state=state,
            live_card=live_card,
            live_card_url=live_card_url,
        )
