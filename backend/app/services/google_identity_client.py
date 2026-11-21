"""Google sign-in: exchange a browser access token for a verified profile.

The browser button returns an OAuth access token. This client asks Google's
tokeninfo endpoint who it belongs to and refuses anything that was not issued for
this application. That audience check is the difference between "a valid Google
token" and "a valid Google token for ProxID", and only the second one may sign
someone in.

The call runs through the injected dependency guard, so it has a timeout, a
breaker and a bounded retry like every other outbound boundary.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from ..core.config import Settings
from ..core.errors import DependencyUnavailableError
from ..core.logging import get_logger
from ..core.resilience import DependencyGuard

logger = get_logger("google_identity")


@dataclass(frozen=True)
class GoogleProfile:
    """The facts Google vouches for. Nothing else is trusted."""

    subject: str
    email: str
    email_verified: bool
    display_name: str
    picture_url: str | None


class GoogleIdentityClient:
    """Verifies Google access tokens. Configured when a client id is present."""

    def __init__(self, settings: Settings, guard: DependencyGuard) -> None:
        self._settings = settings
        self._guard = guard

    @property
    def is_configured(self) -> bool:
        """True when a client id exists, which is what the audience check needs."""
        return bool(self._settings.GOOGLE_CLIENT_ID)

    async def fetch_profile(self, access_token: str) -> GoogleProfile:
        """Return the profile behind an access token, or raise.

        Raises ``DependencyUnavailableError`` when Google cannot be reached or
        answers with anything other than a usable profile.

        Worst-case input: an empty token is rejected by the schema before this
        runs; a token for another application fails the audience check; a token
        with no email or an unverified email is refused rather than trusted.
        """

        async def request() -> dict:
            async with httpx.AsyncClient(timeout=self._settings.GROQ_TIMEOUT_SECONDS) as client:
                response = await client.get(
                    self._settings.GOOGLE_TOKENINFO_URL,
                    params={"access_token": access_token},
                    headers={"Accept": "application/json"},
                )
                if response.status_code == 401:
                    return {}
                response.raise_for_status()
                return response.json()

        payload = await self._guard.call("google_tokeninfo", request)
        if not payload:
            raise DependencyUnavailableError(
                "google",
                "google_tokeninfo returned 401 for the supplied token (layer=http_client)",
                operation="google_sign_in",
                external_message=(
                    "That Google sign-in was not accepted. Close the popup and try again, "
                    "and choose the Google account you want to use with ProxID."
                ),
            )

        audience = str(payload.get("aud") or payload.get("issued_to") or "")
        if self.is_configured and audience and audience != self._settings.GOOGLE_CLIENT_ID:
            raise DependencyUnavailableError(
                "google",
                f"google_tokeninfo audience mismatch: expected={self._settings.GOOGLE_CLIENT_ID} "
                f"received={audience} (layer=http_client)",
                operation="google_sign_in",
                external_message=(
                    "That Google sign-in was issued for a different application, so we did not "
                    "use it. Try signing in again from this page."
                ),
            )

        subject = str(payload.get("sub") or "")
        email = str(payload.get("email") or "").strip().lower()
        verified = str(payload.get("email_verified", "false")).lower() == "true"
        if not subject or not email:
            raise DependencyUnavailableError(
                "google",
                "google_tokeninfo returned a profile without sub or email (layer=http_client)",
                operation="google_sign_in",
                external_message=(
                    "Google did not share an email address, so we cannot create your account. "
                    "Try again and allow access to your basic profile."
                ),
            )
        if not verified:
            raise DependencyUnavailableError(
                "google",
                f"google_tokeninfo reports an unverified email for sub={subject} (layer=http_client)",
                operation="google_sign_in",
                external_message=(
                    "That Google account's email is not verified yet. Verify it with Google, "
                    "then try again."
                ),
            )

        return GoogleProfile(
            subject=subject,
            email=email,
            email_verified=verified,
            display_name=str(payload.get("name") or email.split("@")[0])[:120],
            picture_url=payload.get("picture") or None,
        )
