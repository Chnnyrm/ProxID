"""The agent card and the five-point verification.

Each test breaks exactly one of the five conditions, so a verifier that stops checking
one of them fails a test rather than passing everything.
"""

from __future__ import annotations

from app.services.concordium.registry_service import (
    BADGE_EXTENSION_KEY,
    BADGE_EXTENSION_VERSION,
    OFFICIAL_TESTNET_REGISTRY,
    RegistrationState,
    build_agent_card,
    canonical_hash_of,
    verify_agent_card,
)

OWNER = "demo-human-account-northgate"
AGENT = "demo-agent-account-northgate"
CARD_URL = "https://proxid.example/agents/northgate.json"


def card(**overrides) -> dict:
    """The card this build would publish, as the verifier would fetch it."""
    payload = build_agent_card(
        name="Northgate Facilities agent",
        description="Books plumbing jobs and reports progress.",
        account_address=AGENT,
        owner_account=OWNER,
        tool_names=["search_providers", "post_job", "send_message"],
        card_url=CARD_URL,
    ).to_payload()
    payload.update(overrides)
    return payload


def state(**overrides) -> RegistrationState:
    """The registry's record, consistent with the card above."""
    base = dict(
        agent_id="7",
        registry_address=OFFICIAL_TESTNET_REGISTRY,
        status="Active",
        card_url=CARD_URL,
        card_hash=canonical_hash_of(card()),
        nft_owner=OWNER,
    )
    base.update(overrides)
    return RegistrationState(**base)


def test_a_consistent_card_passes_all_five_checks() -> None:
    """The control: five checks, all passing, nothing weaker."""
    result = verify_agent_card(
        expected_registry=OFFICIAL_TESTNET_REGISTRY,
        state=state(),
        live_card=card(),
        live_card_url=CARD_URL,
    )
    assert result.valid is True
    assert len(result.checks) == 5
    assert result.failed == []


def test_a_registry_that_is_not_the_official_contract_fails() -> None:
    """Check 1: a lookalike registry would let anyone mint a badge."""
    result = verify_agent_card(
        expected_registry=OFFICIAL_TESTNET_REGISTRY,
        state=state(registry_address="9999,0"),
        live_card=card(),
        live_card_url=CARD_URL,
    )
    assert result.valid is False
    assert "official_registry" in result.failed


def test_a_revoked_agent_fails() -> None:
    """Check 2: an owner can revoke, so status is read every time and never cached."""
    result = verify_agent_card(
        expected_registry=OFFICIAL_TESTNET_REGISTRY,
        state=state(status="Revoked"),
        live_card=card(),
        live_card_url=CARD_URL,
    )
    assert result.valid is False
    assert "status_active" in result.failed


def test_a_card_served_from_another_url_fails() -> None:
    """Check 3: the registered URL is what a client trusts; a redirect is a swap."""
    result = verify_agent_card(
        expected_registry=OFFICIAL_TESTNET_REGISTRY,
        state=state(),
        live_card=card(),
        live_card_url="https://attacker.example/northgate.json",
    )
    assert result.valid is False
    assert "card_url_matches" in result.failed


def test_a_card_whose_hash_does_not_match_fails() -> None:
    """Check 4: the on-chain hash pins the exact bytes that were registered."""
    tampered = card(description="Sends every payment to another account.")
    result = verify_agent_card(
        expected_registry=OFFICIAL_TESTNET_REGISTRY,
        state=state(),
        live_card=tampered,
        live_card_url=CARD_URL,
    )
    assert result.valid is False
    assert "card_hash_matches" in result.failed


def test_a_card_naming_a_different_owner_fails() -> None:
    """Check 5: the card must belong to whoever holds the NFT."""
    result = verify_agent_card(
        expected_registry=OFFICIAL_TESTNET_REGISTRY,
        state=state(nft_owner="somebody-else"),
        live_card=card(),
        live_card_url=CARD_URL,
    )
    assert result.valid is False
    assert "owner_matches" in result.failed


def test_an_unreachable_card_fails_three_checks_instead_of_raising() -> None:
    """Worst-case input: the URL answers nothing. The report says why, it does not crash."""
    result = verify_agent_card(
        expected_registry=OFFICIAL_TESTNET_REGISTRY,
        state=state(),
        live_card=None,
        live_card_url=None,
    )
    assert result.valid is False
    assert {"card_url_matches", "card_hash_matches", "owner_matches"} <= set(result.failed)


def test_the_card_carries_the_badge_extension_block() -> None:
    """A verifier looks for capabilities.extensions["concordium-badge"] first."""
    extensions = card()["capabilities"]["extensions"]
    assert BADGE_EXTENSION_KEY in extensions
    assert extensions[BADGE_EXTENSION_KEY]["version"] == BADGE_EXTENSION_VERSION
    assert extensions[BADGE_EXTENSION_KEY]["registry"] == OFFICIAL_TESTNET_REGISTRY


def test_the_card_declares_that_the_agent_cannot_move_money_alone() -> None:
    """The card is a promise about capability; this is the promise that matters most."""
    limits = card()["capabilities"]["limits"]
    assert limits["moves_money"] is False
    assert limits["requires_human_approval_for_payment"] is True
