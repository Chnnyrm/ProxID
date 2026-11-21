"""Sign-up, sign-in, Google, the judge demo session, and sign-out.

Every way into the product ends in the same place: ``issue_session``. That means
one place creates a session row, one place sets the cookie, and one place decides
what a session contains.

Registration and sign-in report failures identically. Sign-in says
``invalid credentials`` for an unknown email and for a wrong password, so the
endpoint cannot be used to discover who has an account.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings
from ..core.errors import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from ..core.logging import get_logger
from ..core.security import (
    decode_session_token,
    hash_password,
    issue_session_token,
    verify_password,
)
from ..crud import session as session_crud
from ..crud import user as user_crud
from ..models.user import User
from ..schemas.user import SessionOut, UserRegister
from .google_identity_client import GoogleIdentityClient
from .user_service import to_me_out

logger = get_logger("auth")

#: The seeded profile the "Launch Judge Demo" button signs into. It exists only
#: after ``python -m app.scripts.seed_demo`` has run, and it is marked ``is_demo``
#: in the row so nothing it touches can be mistaken for a real record.
DEMO_USER_EMAIL = "judge.demo@proxid.local"

#: Where the session cookie is written. HttpOnly, SameSite=Lax, secure in
#: production; the token is also returned in the body for non-browser clients.
SESSION_COOKIE_PATH = "/"


@dataclass(frozen=True)
class Issued:
    """A session ready to be returned and set as a cookie."""

    token: str
    expires_at: datetime
    user: User


class AuthService:
    """The use cases that create and end a session."""

    def __init__(self, settings: Settings, google_client: GoogleIdentityClient) -> None:
        self._settings = settings
        self._google = google_client

    async def register(
        self, db: AsyncSession, payload: UserRegister, *, user_agent: str | None = None
    ) -> Issued:
        """Create an account.

        A duplicate email is a conflict with a usable message. Two racing sign-ups
        for the same email resolve through the unique constraint rather than a
        read-then-write check.
        """
        existing = await user_crud.get_by_email(db, payload.email)
        if existing is not None:
            raise ConflictError(
                f"register_user conflict: email already present for email={payload.email} (layer=crud)",
                operation="register_user",
                external_message="That email is already registered. Sign in instead, or reset your password.",
            )

        try:
            user = await user_crud.create(
                db,
                email=payload.email,
                display_name=payload.display_name,
                hashed_password=hash_password(payload.password),
                role=payload.role,
            )
        except IntegrityError as error:
            logger.warning("register_user raced on the unique email constraint", extra={"error": str(error)})
            raise ConflictError(
                "register_user conflict: unique email constraint violated (layer=crud)",
                operation="register_user",
                external_message="That email is already registered. Sign in instead, or reset your password.",
            ) from error

        return await self._issue(db, user, user_agent=user_agent)

    async def login(
        self, db: AsyncSession, email: str, password: str, *, user_agent: str | None = None
    ) -> Issued:
        """Sign in with an email and a password."""
        user = await user_crud.get_by_email(db, email)
        if user is None or not user.hashed_password:
            raise self._invalid_credentials()
        if not verify_password(password, user.hashed_password):
            raise self._invalid_credentials()
        if not user.is_active:
            raise AuthenticationError(
                f"login_user refused: user_id={user.id} is inactive (layer=service)",
                operation="login_user",
                external_message="This account is closed. Contact support if you think that is wrong.",
            )
        return await self._issue(db, user, user_agent=user_agent)

    async def login_with_google(
        self, db: AsyncSession, access_token: str, *, user_agent: str | None = None
    ) -> Issued:
        """Sign in with a Google access token, creating the account when it is new.

        The profile is verified by ``GoogleIdentityClient`` before it is trusted.
        Two concurrent first-time sign-ins for one Google account are resolved by
        re-reading after a unique-constraint violation instead of failing.
        """
        profile = await self._google.fetch_profile(access_token)

        user = await user_crud.get_by_google_id(db, profile.subject)
        if user is None:
            user = await user_crud.get_by_email(db, profile.email)
            if user is not None:
                user.google_id = profile.subject
                if profile.picture_url and not user.avatar_url:
                    user.avatar_url = profile.picture_url
                await db.flush()
            else:
                try:
                    user = await user_crud.create(
                        db,
                        email=profile.email,
                        display_name=profile.display_name,
                        google_id=profile.subject,
                        avatar_url=profile.picture_url,
                        role="both",
                    )
                except IntegrityError:
                    await db.rollback()
                    user = await user_crud.get_by_google_id(db, profile.subject) or await user_crud.get_by_email(
                        db, profile.email
                    )
                    if user is None:
                        raise ConflictError(
                            "google_sign_in conflict: account appeared and vanished mid-sign-in (layer=crud)",
                            operation="google_sign_in",
                            external_message="We could not finish creating your account. Press the Google button again.",
                        )
        return await self._issue(db, user, user_agent=user_agent)

    async def demo_login(self, db: AsyncSession, *, user_agent: str | None = None) -> Issued:
        """Sign in as the seeded judge profile. No OAuth, no wallet, no password.

        Refuses when the demo feature is off, and refuses with a usable message
        when the seed has not run. It never creates the demo user: a demo account
        invented on the fly would be missing the providers, jobs and receipts the
        demo exists to show.
        """
        if not self._settings.FEATURE_JUDGE_DEMO:
            raise NotFoundError(
                "demo_login refused: FEATURE_JUDGE_DEMO is off (layer=service)",
                operation="demo_login",
                external_message="The judge demo is not enabled on this deployment.",
            )
        user = await user_crud.get_by_email(db, DEMO_USER_EMAIL)
        if user is None or not user.is_demo:
            raise NotFoundError(
                f"demo_login refused: seeded demo user {DEMO_USER_EMAIL} is absent (layer=crud)",
                operation="demo_login",
                external_message=(
                    "The demo profile is not loaded yet. Run "
                    "python -m app.scripts.seed_demo in backend, then press Launch Judge Demo again."
                ),
            )
        return await self._issue(db, user, user_agent=user_agent)

    async def logout(self, db: AsyncSession, token: str) -> None:
        """Invalidate the session server-side, not only in the browser.

        A token that cannot be decoded is already unusable, so it is treated as a
        successful sign-out rather than an error.
        """
        try:
            claims = decode_session_token(token, self._settings)
        except AuthenticationError:
            return
        await session_crud.revoke(db, uuid.UUID(str(claims["jti"])))

    async def resolve_session(self, db: AsyncSession, token: str) -> User:
        """The user behind a token, or an AuthenticationError.

        Both halves are checked: the signature and claims, and the server-side
        session row that logout revokes.
        """
        claims = decode_session_token(token, self._settings)
        session_id = uuid.UUID(str(claims["jti"]))
        active = await session_crud.get_active(db, session_id)
        if active is None:
            raise AuthenticationError(
                f"resolve_session refused: session {session_id} is revoked or expired (layer=crud)",
                operation="authenticate_request",
                external_message="Your session has ended. Sign in again to continue.",
            )
        user = await user_crud.get_by_id(db, uuid.UUID(str(claims["sub"])))
        if user is None or not user.is_active:
            raise AuthenticationError(
                f"resolve_session refused: user {claims.get('sub')} is missing or inactive (layer=service)",
                operation="authenticate_request",
                external_message="Your session has ended. Sign in again to continue.",
            )
        return user

    async def session_payload(self, db: AsyncSession, issued: Issued) -> SessionOut:
        """The response body for a successful sign-in."""
        return SessionOut(
            access_token=issued.token,
            expires_at=issued.expires_at,
            user=to_me_out(issued.user),
        )

    async def _issue(self, db: AsyncSession, user: User, *, user_agent: str | None) -> Issued:
        token = issue_session_token(user.id, self._settings)
        await session_crud.create(
            db,
            session_id=uuid.UUID(token.session_id),
            user_id=user.id,
            issued_at=datetime.now(issued.expires_at.tzinfo),
            expires_at=token.expires_at,
            user_agent=user_agent,
        )
        logger.info(
            "session issued",
            extra={"operation": "issue_session", "user_id": str(user.id), "is_demo": user.is_demo},
        )
        return Issued(token=token.token, expires_at=token.expires_at, user=user)

    @staticmethod
    def _invalid_credentials() -> AuthenticationError:
        """The one rendering for every sign-in failure, deliberately."""
        return AuthenticationError(
            "login_user failed: credentials did not match a usable account (layer=service)",
            operation="login_user",
            external_message="That email and password do not match an account. Check them, or reset your password.",
        )

    def validate_password(self, password: str) -> None:
        """Reject an empty or oversized password before it reaches bcrypt."""
        if not password or len(password) > 128:
            raise ValidationError(
                "validate_password refused: empty or over 128 characters (layer=service)",
                operation="validate_password",
                external_message="Enter your password. It can be up to 128 characters.",
            )
