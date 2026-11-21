"""Brevo transactional email, behind a guard and a feature flag.

Ported from Gigr's ``services/brevo_client.py``. The behaviour kept: one POST to
Brevo's SMTP endpoint with a sender, one recipient, a subject and HTML. What
changed: the API key is read from injected settings rather than captured at import
time (a module-level constant captured the key before configuration was loaded),
the call goes through the dependency guard, and delivery is off unless
``FEATURE_EMAIL_DELIVERY`` is on.

HTML passed here is built by this application, never by a user. A user-supplied
string is rendered into the template after escaping at the call site.
"""

from __future__ import annotations

import httpx

from ..core.config import Settings
from ..core.errors import DependencyUnavailableError, ValidationError
from ..core.logging import get_logger
from ..core.resilience import DependencyGuard

logger = get_logger("brevo")


class BrevoClient:
    """Sends one transactional email. Inert until the feature is switched on."""

    def __init__(self, settings: Settings, guard: DependencyGuard) -> None:
        self._settings = settings
        self._guard = guard

    @property
    def is_configured(self) -> bool:
        """True when the flag is on, a key exists and a sender is set."""
        return bool(
            self._settings.FEATURE_EMAIL_DELIVERY
            and self._settings.BREVO_API_KEY
            and self._settings.BREVO_SENDER_EMAIL
        )

    async def send_email(self, *, to_email: str, subject: str, html_content: str) -> bool:
        """Send one email. Returns True when Brevo accepted it.

        Raises ``ValidationError`` for a missing recipient or subject, and
        ``DependencyUnavailableError`` when the integration is off or unreachable.

        Worst-case input: an address with no ``@`` is refused before the call; a
        body over Brevo's 10 MB limit is refused by the length check; a Brevo
        outage surfaces as a retryable dependency error.
        """
        if not self.is_configured:
            raise DependencyUnavailableError(
                "brevo",
                "send_email refused: email delivery is disabled or unconfigured (layer=http_client)",
                operation="send_email",
                external_message=(
                    "Email is not switched on for this deployment. Your details were saved, "
                    "and you can continue in the app."
                ),
            )
        if "@" not in (to_email or ""):
            raise ValidationError(
                f"send_email refused: recipient is not an address (layer=service)",
                operation="send_email",
                external_message="That email address looks incomplete. Check it and try again.",
            )
        if not subject.strip():
            raise ValidationError(
                "send_email refused: empty subject (layer=service)",
                operation="send_email",
                external_message="Give the email a subject before sending it.",
            )
        if len(html_content) > 1_000_000:
            raise ValidationError(
                f"send_email refused: body of {len(html_content)} characters is too large (layer=service)",
                operation="send_email",
                external_message="That email is too long to send. Shorten it and try again.",
            )

        payload = {
            "sender": {
                "email": self._settings.BREVO_SENDER_EMAIL,
                "name": self._settings.BREVO_SENDER_NAME,
            },
            "to": [{"email": to_email.strip().lower()}],
            "subject": subject.strip()[:200],
            "htmlContent": html_content,
        }

        async def call() -> httpx.Response:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self._settings.BREVO_API_URL,
                    headers={
                        "api-key": self._settings.BREVO_API_KEY,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                return response

        try:
            await self._guard.call("brevo_send", call)
        except DependencyUnavailableError:
            raise
        except Exception as error:  # noqa: BLE001 - mapped to the external message below
            raise DependencyUnavailableError(
                "brevo",
                f"send_email failed: {type(error).__name__} (layer=http_client)",
                operation="send_email",
                external_message=(
                    "We could not send that email just now. Nothing was lost, and you can "
                    "continue in the app. Try again in a moment."
                ),
            ) from error
        return True
