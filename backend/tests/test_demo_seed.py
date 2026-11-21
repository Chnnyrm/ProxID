"""The Judge Demo's data invariants.

A demo record that could pass for chain data is the worst outcome of a demonstration, so
these tests pin that it cannot: ids are deterministic, every row is marked, and nothing
that stands in for an address or a hash can parse as one.
"""

from __future__ import annotations

import re

from app.scripts.seed_demo import (
    DEMO_USER_EMAIL,
    JOBS,
    NEIGHBOURHOOD_CENTRE,
    PROVIDERS,
    demo_id,
)

#: A Concordium account address is base58check, 45 to 55 characters, no 0/O/I/l.
ACCOUNT_ADDRESS = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{45,55}$")

#: A 32-byte transaction hash in hex.
TX_HASH = re.compile(r"^[0-9a-f]{64}$")


def test_a_demo_id_is_stable_across_runs() -> None:
    """Without this the seed would duplicate every row on the second run."""
    assert demo_id("user:judge-demo") == demo_id("user:judge-demo")
    assert demo_id("user:judge-demo") != demo_id("user:northgate")


def test_the_demo_people_are_marked_demo_in_their_data() -> None:
    """The demo profile is real data the app queries, so the mark lives on the row."""
    assert DEMO_USER_EMAIL.endswith(".local")


def test_every_placeholder_account_is_obviously_not_an_address() -> None:
    """A judge, or a script, must be unable to mistake a placeholder for a chain value."""
    placeholders = [f"demo-human-account-{provider.key}" for provider in PROVIDERS]
    placeholders += [provider.agent_account for provider in PROVIDERS if provider.agent_account]
    assert placeholders
    for value in placeholders:
        assert value.startswith("demo-")
        assert not ACCOUNT_ADDRESS.match(value), value


def test_no_demo_value_could_be_read_as_a_transaction_hash() -> None:
    """A receipt with a hash-shaped string would look settled. None of them do."""
    for job in JOBS:
        if job.receipt:
            assert not TX_HASH.match(job.receipt)


def test_every_verified_provider_carries_a_proof_reference() -> None:
    """A badge with nothing behind it is exactly what this product refuses to show."""
    verified = [provider for provider in PROVIDERS if provider.verified]
    assert len(verified) >= 3
    for provider in verified:
        assert provider.proof_reference is not None
        assert provider.proof_reference.startswith("demo-proof-ref-")


def test_a_provider_without_a_proof_is_not_verified() -> None:
    """The unverified provider in the demo proves the badge is not granted to everyone."""
    unverified = [provider for provider in PROVIDERS if not provider.verified]
    assert unverified
    for provider in unverified:
        assert provider.proof_reference is None


def test_one_provider_is_a_company_with_its_own_agent() -> None:
    """Beat one of the demo: a company-backed agent, not only a person."""
    companies = [provider for provider in PROVIDERS if provider.company]
    assert len(companies) == 1
    assert companies[0].agent_account is not None
    assert companies[0].agent_account != f"demo-human-account-{companies[0].key}"


def test_the_jobs_cover_open_completed_and_an_active_room() -> None:
    """Beats three and four need a room with messages and a completed job beside it."""
    statuses = {job.status for job in JOBS}
    assert {"open", "in_progress", "completed"} <= statuses
    active = [job for job in JOBS if job.status == "in_progress"]
    assert active and len(active[0].messages) >= 3


def test_every_job_is_inside_one_neighbourhood() -> None:
    """A hyper-local demo whose pins are spread over a city is not a neighbourhood."""
    latitude, longitude = NEIGHBOURHOOD_CENTRE
    for job in JOBS:
        assert abs(job.latitude - latitude) < 0.02
        assert abs(job.longitude - longitude) < 0.02


def test_the_room_shows_the_handover_between_a_person_and_an_agent() -> None:
    """The agent's line is written as the agent, so the log and the thread agree."""
    active = next(job for job in JOBS if job.status == "in_progress")
    authors = {author for author, _body in active.messages}
    assert {"client", "provider", "agent"} <= authors
