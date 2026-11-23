"""Tests for AuthService session issuance and demo login invariants.

These tests close the coverage gap where AuthService._issue was previously unexercised,
allowing a NameError on issued.expires_at to ship to production and break login.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.config import Settings
from app.core.security import decode_session_token
from app.crud import user as user_crud
from app.models.user import User, UserSession
from app.services.auth_service import DEMO_USER_EMAIL, AuthService, Issued


@pytest.fixture
def auth_service() -> AuthService:
    settings = Settings(
        SECRET_KEY="test-secret-key-that-is-long-enough-32-chars",
        FEATURE_JUDGE_DEMO=True,
    )
    google_mock = MagicMock()
    return AuthService(settings=settings, google_client=google_mock)


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="provider@example.local",
        display_name="Ada Lovelace",
        role="both",
        is_demo=False,
    )


@pytest.fixture
def demo_user() -> User:
    return User(
        id=uuid.uuid4(),
        email=DEMO_USER_EMAIL,
        display_name="Judge Demo",
        role="both",
        is_demo=True,
    )


class SessionTrackingDb:
    """Minimal async database session mock that records created sessions."""

    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        pass


@pytest.mark.asyncio
async def test_issue_returns_an_issued_with_a_token_an_expiry_and_the_user(
    auth_service: AuthService, test_user: User
) -> None:
    """_issue must return an Issued record containing a valid token, an expiry, and the user."""
    db = SessionTrackingDb()
    issued = await auth_service._issue(db, test_user, user_agent="test-agent/1.0")

    assert isinstance(issued, Issued)
    assert isinstance(issued.token, str) and len(issued.token) > 0
    assert issued.expires_at is not None
    assert issued.user == test_user

    claims = decode_session_token(issued.token, auth_service._settings)
    assert claims["sub"] == str(test_user.id)
    assert claims["typ"] == "session"

    session_records = [obj for obj in db.added if isinstance(obj, UserSession)]
    assert len(session_records) == 1
    record = session_records[0]
    assert record.user_id == test_user.id
    assert str(record.id) == claims["jti"]
    assert record.expires_at == issued.expires_at


@pytest.mark.asyncio
async def test_demo_login_returns_a_session_for_the_seeded_demo_user(
    auth_service: AuthService, demo_user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    """demo_login must return a session for the seeded demo user when configured."""
    db = SessionTrackingDb()
    monkeypatch.setattr(user_crud, "get_by_email", AsyncMock(return_value=demo_user))

    issued = await auth_service.demo_login(db, user_agent="demo-browser/1.0")

    assert isinstance(issued, Issued)
    assert issued.user.is_demo is True
    assert issued.user.email == DEMO_USER_EMAIL
    assert issued.token is not None

    claims = decode_session_token(issued.token, auth_service._settings)
    assert claims["sub"] == str(demo_user.id)


@pytest.mark.asyncio
async def test_calling_either_twice_does_not_create_a_duplicate_session_for_the_same_token(
    auth_service: AuthService,
    test_user: User,
    demo_user: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Calling _issue or demo_login twice creates unique session tokens with distinct session ids."""
    db = SessionTrackingDb()
    monkeypatch.setattr(user_crud, "get_by_email", AsyncMock(return_value=demo_user))

    # 1. Calling _issue twice
    issued1 = await auth_service._issue(db, test_user, user_agent="agent-1")
    issued2 = await auth_service._issue(db, test_user, user_agent="agent-2")

    assert issued1.token != issued2.token
    claims1 = decode_session_token(issued1.token, auth_service._settings)
    claims2 = decode_session_token(issued2.token, auth_service._settings)
    assert claims1["jti"] != claims2["jti"]

    # 2. Calling demo_login twice
    demo1 = await auth_service.demo_login(db)
    demo2 = await auth_service.demo_login(db)

    assert demo1.token != demo2.token
    demo_claims1 = decode_session_token(demo1.token, auth_service._settings)
    demo_claims2 = decode_session_token(demo2.token, auth_service._settings)
    assert demo_claims1["jti"] != demo_claims2["jti"]

    # Verify each issuance added a distinct UserSession row
    sessions = [obj for obj in db.added if isinstance(obj, UserSession)]
    assert len(sessions) == 4
    session_ids = {s.id for s in sessions}
    assert len(session_ids) == 4
