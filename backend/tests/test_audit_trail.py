"""The Article 12 audit pattern: nonce, hash, and no personal data in either.

These tests pin the two properties that make the pattern worth anything: the same event
hashes differently on two occasions (so the chain is not a lookup table), and a
free-form string never reaches the stored detail as text.
"""

from __future__ import annotations

from app.services.concordium.audit_service import (
    FORBIDDEN_FIELDS,
    canonicalise,
    new_nonce,
    payload_hash,
    reduce_text,
    safe_detail,
)


def test_the_same_payload_hashes_differently_under_a_different_nonce() -> None:
    """Two identical logins must not produce the same on-chain hash."""
    payload = {"action": "login_user", "outcome": "success"}
    first = payload_hash(new_nonce(), payload)
    second = payload_hash(new_nonce(), payload)
    assert first != second


def test_the_hash_is_stable_for_the_same_nonce_and_payload() -> None:
    """Determinism is what lets a record be verified later."""
    payload = {"action": "post_job", "outcome": "success"}
    nonce = "0123456789abcdef0123456789abcdef"
    assert payload_hash(nonce, payload) == payload_hash(nonce, payload)


def test_the_nonce_is_part_of_the_hash_input() -> None:
    """Changing only the nonce must change the digest, or the salt is decorative."""
    payload = {"action": "post_job"}
    assert payload_hash("a" * 32, payload) != payload_hash("b" * 32, payload)


def test_canonical_form_does_not_depend_on_key_order() -> None:
    """A dict built in another order must hash the same, or the trail is unreproducible."""
    assert canonicalise({"b": 1, "a": 2}) == canonicalise({"a": 2, "b": 1})


def test_a_message_body_never_reaches_the_stored_detail_as_text() -> None:
    """A free-form string becomes a length and a digest, never the words."""
    detail = safe_detail({"body": "my address is 14 Herbert Macaulay Way"})
    assert "body" not in detail
    assert "14 Herbert" not in str(detail)


def test_an_unknown_free_text_field_is_reduced_not_stored() -> None:
    """Any string that is not structural is reduced, so a new field cannot leak."""
    detail = safe_detail({"note": "call me on 0803 000 0000"})
    assert "call me" not in str(detail)
    assert detail["note"]["text_length"] == len("call me on 0803 000 0000")
    assert len(str(detail["note"]["text_digest"])) == 16


def test_structural_fields_pass_through_so_the_trail_stays_useful() -> None:
    """A status and an amount are what an audit row is for."""
    detail = safe_detail({"status": "success", "amount": 12000.0, "tool": "post_job"})
    assert detail == {"status": "success", "amount": 12000.0, "tool": "post_job"}


def test_the_forbidden_field_names_include_the_ones_that_identify_a_person() -> None:
    """The list is the review surface: an email or a name must never be a detail key."""
    assert {"email", "name", "body", "prompt", "output"} <= FORBIDDEN_FIELDS


def test_reduce_text_reports_length_and_a_short_digest() -> None:
    """What a prompt or an output becomes: enough to correlate, not enough to read."""
    reduced = reduce_text("a prompt the user typed")
    assert reduced["text_length"] == 23
    assert len(str(reduced["text_digest"])) == 16
