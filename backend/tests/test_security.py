"""Password hashing and session tokens.

The tests that matter here are the negative ones: a wrong password must fail, a token
signed with another key must fail, and a token of the wrong type must fail.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.core.config import Settings
from app.core.errors import AuthenticationError
from app.core.security import (
    SESSION_ALGORITHM,
    decode_session_token,
    hash_password,
    issue_session_token,
    verify_password,
)

SETTINGS = Settings(SECRET_KEY="a" * 40)


def test_a_password_verifies_against_its_own_hash() -> None:
    """The round trip, as the control for the negative tests."""
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed)


def test_a_wrong_password_does_not_verify() -> None:
    """A hash that accepted everything would be worse than no hash."""
    hashed = hash_password("correct horse battery staple")
    assert not verify_password("correct horse battery stapl", hashed)


def test_a_password_longer_than_bcrypt_reads_is_truncated_consistently() -> None:
    """bcrypt reads 72 bytes; the truncation must be the same on both sides."""
    long_password = "x" * 100
    hashed = hash_password(long_password)
    assert verify_password(long_password, hashed)
    # The 73rd byte onward is not part of the hash, and that is stated, not hidden.
    assert verify_password("x" * 72 + "different tail", hashed)


def test_a_malformed_hash_returns_false_instead_of_raising() -> None:
    """One corrupt row must not turn a login attempt into a 500."""
    assert not verify_password("anything", "not-a-bcrypt-hash")


def test_a_hashed_password_is_not_the_password() -> None:
    """A regression that stored the plaintext would be caught here."""
    hashed = hash_password("hunter2hunter2")
    assert "hunter2hunter2" not in hashed
    assert hashed.startswith("$2b$")


def test_a_fresh_session_token_decodes_to_its_subject() -> None:
    """The happy path for the token, used by every authenticated request."""
    user_id = uuid.uuid4()
    issued = issue_session_token(user_id, SETTINGS)
    claims = decode_session_token(issued.token, SETTINGS)
    assert claims["sub"] == str(user_id)
    assert claims["jti"] == issued.session_id
    assert claims["typ"] == "session"


def test_a_token_signed_with_another_key_is_rejected() -> None:
    """Signature verification is the only thing standing between a guess and a session."""
    issued = issue_session_token(uuid.uuid4(), SETTINGS)
    other = Settings(SECRET_KEY="b" * 40)
    with pytest.raises(AuthenticationError):
        decode_session_token(issued.token, other)


def test_an_unsigned_token_is_rejected() -> None:
    """alg: none is the classic bypass, and the pinned algorithm must refuse it."""
    unsigned = jwt.encode(
        {"sub": str(uuid.uuid4()), "jti": str(uuid.uuid4()), "typ": "session"},
        key="",
        algorithm="none",
    )
    with pytest.raises(AuthenticationError):
        decode_session_token(unsigned, SETTINGS)


def test_an_expired_token_is_rejected() -> None:
    """A session that never expires is a session that cannot be revoked in practice."""
    expired = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "jti": str(uuid.uuid4()),
            "typ": "session",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        },
        SETTINGS.SECRET_KEY,
        algorithm=SESSION_ALGORITHM,
    )
    with pytest.raises(AuthenticationError):
        decode_session_token(expired, SETTINGS)


def test_a_token_of_the_wrong_type_is_rejected() -> None:
    """A refresh or a one-time token must not authenticate a request."""
    wrong_type = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "jti": str(uuid.uuid4()),
            "typ": "refresh",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        SETTINGS.SECRET_KEY,
        algorithm=SESSION_ALGORITHM,
    )
    with pytest.raises(AuthenticationError):
        decode_session_token(wrong_type, SETTINGS)


def test_a_token_without_a_jti_is_rejected() -> None:
    """No jti means no server-side session, which means logout could not revoke it."""
    no_jti = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "typ": "session",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        SETTINGS.SECRET_KEY,
        algorithm=SESSION_ALGORITHM,
    )
    with pytest.raises(AuthenticationError):
        decode_session_token(no_jti, SETTINGS)


def test_the_runtime_configuration_refuses_a_short_secret() -> None:
    """Fail loudly at boot, not silently at the first login."""
    with pytest.raises(RuntimeError) as error:
        Settings(SECRET_KEY="too-short").assert_runtime_configuration()
    assert "SECRET_KEY" in str(error.value)


def test_cors_refuses_a_wildcard_origin() -> None:
    """A wildcard with credentials hands every site the user's session."""
    with pytest.raises(ValueError):
        Settings(CORS_ORIGINS="*")
