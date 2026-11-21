"""The eight rules the server side can check before a payment is submitted.

Rule 8, the sender signature, needs the facilitator's verifier and is deliberately not
attempted here: these tests pin that the other eight are real, and that a broken
payload is refused with the rule named.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.services.concordium.x402_service import (
    PaymentRequirements,
    SignedPayload,
    all_passed,
    check_local_rules,
    expiry_from,
)

NOW = datetime(2026, 11, 21, 12, 0, tzinfo=timezone.utc)


def requirements(**overrides) -> PaymentRequirements:
    """A well-formed requirement, so a test changes only the field it is about."""
    base = dict(
        scheme="exact",
        network="ccd:4221332d34e1694168c2a0c0b3fd0f27",
        pay_to="4FmiTW2L4RvCsSVTjFAavYvrgnPLGNj43eiwPYmbhNqtAcMbWW",
        amount="12000000",
        asset="CCD",
        description="ProxID job: fix the sink",
        fee_payer="4SponsorAddressForTheFacilitator0000000000000000",
        max_timeout_seconds=600,
    )
    base.update(overrides)
    return PaymentRequirements(**base)


def payload(**overrides) -> SignedPayload:
    """A well-formed signed payload."""
    base = dict(signed_transaction="deadbeef::Transfer{amount=12000000}", sender="4SenderAddress")
    base.update(overrides)
    return SignedPayload(**base)


def run(requirements_value=None, payload_value=None, expires_at=None):
    req = requirements_value or requirements()
    return check_local_rules(
        requirements=req,
        payload=payload_value or payload(),
        now=NOW,
        expires_at=expires_at or NOW + timedelta(minutes=5),
        max_expiry_offset_seconds=600,
    )


def test_a_well_formed_payment_passes_every_local_rule() -> None:
    """The happy path, as the control for the tests below."""
    results = run()
    assert all_passed(results)
    assert len(results) == 8


def test_amount_must_be_atomic_integer_units_not_a_decimal() -> None:
    """Rule 5: "12.0" is not an amount. Atomic units are a digit string, exactly."""
    results = run(requirements_value=requirements(amount="12.0"))
    failed = [rule.rule for rule in results if not rule.passed]
    assert failed == ["amount_exact"]


def test_amount_must_be_positive() -> None:
    """Rule 5 again: a zero payment is not a payment."""
    results = run(requirements_value=requirements(amount="0"))
    assert "amount_exact" in [rule.rule for rule in results if not rule.passed]


def test_a_payment_past_its_expiry_is_refused() -> None:
    """Rule 7: the window is checked against the requirement, not the clock alone."""
    results = run(expires_at=NOW - timedelta(seconds=1))
    failed = [rule.rule for rule in results if not rule.passed]
    assert failed == ["expiry_window"]


def test_an_expiry_beyond_the_offset_limit_is_refused() -> None:
    """Rule 7: the package rejects an expiry further out than 600 seconds."""
    results = run(expires_at=NOW + timedelta(seconds=601))
    assert "expiry_window" in [rule.rule for rule in results if not rule.passed]


def test_a_payload_with_no_sender_is_refused() -> None:
    """Rule 2: the payload must name who is paying."""
    results = run(payload_value=payload(sender=""))
    assert "sender_identity" in [rule.rule for rule in results if not rule.passed]


def test_requirements_without_a_fee_payer_are_refused() -> None:
    """Rule 3: without a sponsor there is nobody to pay the gas, so nothing settles."""
    results = run(requirements_value=requirements(fee_payer=None))
    assert "sponsor_identity" in [rule.rule for rule in results if not rule.passed]


def test_requirements_without_a_recipient_are_refused() -> None:
    """Rule 4: money with no destination is not a transfer."""
    results = run(requirements_value=requirements(pay_to=""))
    assert "transfer_destination" in [rule.rule for rule in results if not rule.passed]


def test_requirements_without_an_asset_are_refused() -> None:
    """Rule 6: CCD and a PLT token are different assets and must not be conflated."""
    results = run(requirements_value=requirements(asset=""))
    assert "asset_matches" in [rule.rule for rule in results if not rule.passed]


def test_two_transfers_in_one_payload_are_refused() -> None:
    """Rule 9: one payment, one transfer. A second transfer is how a drain hides."""
    results = run(payload_value=payload(signed_transaction="Transfer{} Transfer{}"))
    assert "single_transfer" in [rule.rule for rule in results if not rule.passed]


def test_every_failed_rule_is_reported_not_just_the_first() -> None:
    """A refused payment must be able to say everything that is wrong with it."""
    results = run(requirements_value=requirements(amount="0", pay_to="", asset=""))
    failed = {rule.rule for rule in results if not rule.passed}
    assert failed == {"amount_exact", "transfer_destination", "asset_matches"}


def test_to_atomic_units_is_exact_for_a_value_that_float_gets_wrong() -> None:
    """0.29 * 10**6 is 289999.99999999994 in floating point; the rail would refuse it."""
    from app.services.payment_service import to_atomic_units

    assert to_atomic_units(0.29, 6) == 290000
    assert to_atomic_units(19.99, 6) == 19990000


def test_expiry_is_derived_from_the_requirements_own_timeout() -> None:
    """The requirement carries its timeout; the caller must not invent a longer one."""
    req = requirements(max_timeout_seconds=120)
    delta = expiry_from(req) - datetime.now(timezone.utc)
    assert 118 <= delta.total_seconds() <= 120
