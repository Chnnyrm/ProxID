"""Password hashing, session tokens and constant-time comparison helpers.

bcrypt is used directly rather than through passlib: passlib 1.7.4 is
unmaintained and crashes on initialisation with bcrypt 5.x, which broke all
password hashing in the predecessor project. bcrypt and the hashes it produces
are standard ``$2b$`` so this is a drop-in.

Sessions are JWTs with the algorithm pinned on verification. Every token carries
a ``jti`` that is also stored server-side, so logout can invalidate it for real
instead of only clearing the cookie.
"""

from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError

from .config import Settings
from .errors import AuthenticationError

#: Pinned. ``alg: none`` and algorithm confusion are rejected because the decode
#: call names exactly this algorithm and nothing else.
SESSION_ALGORITHM = "HS256"

#: bcrypt only reads the first 72 bytes and raises on longer input in 5.x.
_BCRYPT_MAX_BYTES = 72


def _to_72_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """Hash a password with bcrypt and a per-password salt."""
    return bcrypt.hashpw(_to_72_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time check of a password against a stored hash.

    Returns False for a malformed hash rather than raising, so a corrupted row
    cannot turn a login attempt into a 500.
    """
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(_to_72_bytes(plain_password), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


@dataclass(frozen=True)
class IssuedSession:
    """A signed session token and the facts about it the caller must persist."""

    token: str
    session_id: str
    expires_at: datetime


def issue_session_token(user_id: uuid.UUID, settings: Settings) -> IssuedSession:
    """Sign a session token for one user.

    The ``jti`` is random, not derived from the user, so two logins cannot
    collide or be guessed from each other.
    """
    session_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.SESSION_TOKEN_TTL_HOURS)
    payload = {
        "sub": str(user_id),
        "jti": str(session_id),
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
        "typ": "session",
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=SESSION_ALGORITHM)
    return IssuedSession(token=token, session_id=str(session_id), expires_at=expires_at)


def decode_session_token(token: str, settings: Settings) -> dict[str, object]:
    """Verify a session token and return its claims.

    Raises ``AuthenticationError`` for anything that is not a live session token:
    a bad signature, an expired token, a wrong token type, or a missing subject.
    The external message never says which of those it was.
    """
    try:
        claims = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[SESSION_ALGORITHM],
            options={"require": ["exp", "sub", "jti"]},
        )
    except InvalidTokenError as error:
        raise AuthenticationError(
            f"session token rejected: {type(error).__name__} (layer=security)",
            operation="authenticate_request",
            external_message="Your session has ended. Sign in again to continue.",
        ) from error

    if claims.get("typ") != "session":
        raise AuthenticationError(
            "session token rejected: wrong typ claim (layer=security)",
            operation="authenticate_request",
            external_message="Your session has ended. Sign in again to continue.",
        )
    return claims


def generate_csrf_token() -> str:
    """A CSRF token with 256 bits of entropy, for double-submit protection."""
    return secrets.token_urlsafe(32)
