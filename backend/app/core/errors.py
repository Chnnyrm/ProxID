"""Typed errors, split into an internal view and a user-facing view.

Every failure the application raises on purpose descends from
``ApplicationError``. The internal message names the operation, the entity and
its identifier, the layer that raised it and the correlation ID, because that is
what an engineer needs. ``external_message`` is what the caller receives: a
sentence a person can act on, never a stack trace, an identifier, a path or an
internal name.

Both views carry the same correlation ID, so the user's "reference" line and the
engineer's log line meet in exactly one place.
"""

from __future__ import annotations

from typing import Any


class ApplicationError(Exception):
    """Base class for every error this application raises deliberately."""

    code = "application_error"
    http_status = 500
    layer = "service"

    def __init__(
        self,
        message: str,
        *,
        operation: str,
        external_message: str,
        correlation_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.operation = operation
        self.external_message = external_message
        self.correlation_id = correlation_id
        self.details = details or {}

    def with_correlation_id(self, correlation_id: str) -> "ApplicationError":
        """Attach the request's correlation ID; idempotent."""
        if self.correlation_id is None:
            self.correlation_id = correlation_id
        return self

    def to_log_context(self) -> dict[str, Any]:
        """The internal view, ready for the structured logger."""
        context: dict[str, Any] = {
            "code": self.code,
            "operation": self.operation,
            "layer": self.layer,
            "correlation_id": self.correlation_id,
            "internal_message": self.message,
        }
        if self.details:
            context["details"] = self.details
        return context


class ValidationError(ApplicationError):
    """Input was rejected at the boundary. The field is named in the message."""

    code = "validation_error"
    http_status = 422
    layer = "router"


class AuthenticationError(ApplicationError):
    """No valid session. Says ``invalid credentials``, never why."""

    code = "authentication_failed"
    http_status = 401


class AuthorizationError(ApplicationError):
    """Authenticated, but not allowed to touch this object or perform this action."""

    code = "not_allowed"
    http_status = 403


class NotFoundError(ApplicationError):
    """A row the caller needed does not exist."""

    code = "not_found"
    http_status = 404
    layer = "crud"


class ConflictError(ApplicationError):
    """The request collided with the current state: a duplicate or a stale write."""

    code = "conflict"
    http_status = 409


class RateLimitError(ApplicationError):
    """Too many requests from this principal in the window."""

    code = "rate_limited"
    http_status = 429


class DependencyUnavailableError(ApplicationError):
    """An outbound dependency failed or its breaker is open, with no fallback."""

    code = "dependency_unavailable"
    http_status = 503

    def __init__(
        self,
        dependency: str,
        message: str,
        *,
        operation: str,
        external_message: str,
    ) -> None:
        super().__init__(
            message,
            operation=operation,
            external_message=external_message,
            details={"dependency": dependency},
        )


class NotConfiguredError(ApplicationError):
    """The feature exists but its credentials or contract addresses have not arrived.

    This is the honest answer while the Concordium integration is unconfigured:
    the request is understood, nothing is attempted, and the caller is told the
    integration is pending rather than that it failed.
    """

    code = "not_configured"
    http_status = 503

    def __init__(self, integration: str, *, operation: str) -> None:
        super().__init__(
            f"{operation} refused: {integration} is not configured "
            f"(no credentials or contract address). layer=service",
            operation=operation,
            external_message=(
                f"{integration} is not connected yet. This part of ProxID is built and "
                "waiting for its credentials, so nothing was sent or charged."
            ),
            details={"integration": integration},
        )
