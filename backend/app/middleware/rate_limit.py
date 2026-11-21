"""Rate limiting per principal, with the principal's IP as the fallback.

Three classes of endpoint, from configuration: authentication, any write, and
everything else. The counter is a fixed window in process memory.

This is honest about its limit: with more than one worker process each worker has
its own counter, so the effective limit is the configured limit times the worker
count. That is acceptable for a single-instance deployment and is stated here and
in the README rather than discovered later. A shared Redis counter is the upgrade
path and does not change this interface.

Rate limiting is never behind a feature flag: it is always on.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from ..core.config import Settings
from ..core.logging import correlation_id_var, get_logger

logger = get_logger("rate_limit")

#: Endpoints where a wrong guess is the attack, so the limit is the lowest.
AUTH_PATHS = ("/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/google", "/api/v1/auth/demo-login")

#: Methods that change state and therefore cost something to repeat.
WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


@dataclass
class _Window:
    """One fixed window for one bucket key."""

    started_at: float
    count: int


class RateLimitMiddleware(BaseHTTPMiddleware):
    """A fixed-window limiter, per principal, with three endpoint classes."""

    def __init__(self, app, settings: Settings) -> None:
        super().__init__(app)
        self._settings = settings
        self._windows: dict[str, _Window] = {}
        self._window_seconds = 60.0

    def _limit_for(self, request: Request) -> int:
        if request.url.path.startswith(AUTH_PATHS):
            return self._settings.RATE_LIMIT_AUTH_PER_MINUTE
        if request.method in WRITE_METHODS:
            return self._settings.RATE_LIMIT_WRITE_PER_MINUTE
        return self._settings.RATE_LIMIT_DEFAULT_PER_MINUTE

    def _principal(self, request: Request) -> str:
        """Who is being limited.

        The session cookie identifies a person where one exists. Otherwise the
        client address does. Behind a proxy, the forwarding header is trusted only
        because this deployment sits behind one; a direct-exposed deployment must
        not trust it, and ``X-Forwarded-For`` is not otherwise read anywhere.
        """
        cookie = request.cookies.get(self._settings.SESSION_COOKIE_NAME)
        if cookie:
            # A short digest is enough to bucket by person without storing a token.
            import hashlib

            return "session:" + hashlib.sha256(cookie.encode("utf-8")).hexdigest()[:24]
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return "ip:" + forwarded.split(",")[0].strip()
        client = request.client
        return "ip:" + (client.host if client else "unknown")

    async def dispatch(self, request: Request, call_next):
        # Cheap liveness and documentation paths are not limited: a health check
        # that can be throttled is a health check that lies.
        if request.url.path in ("/health", "/api/v1/health") or request.url.path.startswith("/docs"):
            return await call_next(request)

        key = f"{self._principal(request)}:{self._class_of(request)}"
        now = time.monotonic()
        window = self._windows.get(key)
        if window is None or now - window.started_at >= self._window_seconds:
            window = _Window(started_at=now, count=0)
            self._windows[key] = window

        limit = self._limit_for(request)
        if window.count >= limit:
            reference = correlation_id_var.get()
            logger.warning(
                "rate limit reached",
                extra={
                    "operation": "rate_limit",
                    "path": request.url.path,
                    "limit": limit,
                    "correlation_id": reference,
                },
            )
            retry_after = max(1, int(self._window_seconds - (now - window.started_at)))
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "rate_limited",
                        "message": (
                            "That is a lot of requests in a short time. Wait about "
                            f"{retry_after} seconds and try again."
                        ),
                        "reference": reference,
                    }
                },
                headers={"Retry-After": str(retry_after)},
            )

        window.count += 1
        self._prune(now)
        return await call_next(request)

    def _class_of(self, request: Request) -> str:
        """The bucket an endpoint belongs to, so one limit does not starve another."""
        if request.url.path.startswith(AUTH_PATHS):
            return "auth"
        if request.method in WRITE_METHODS:
            return "write"
        return "read"

    def _prune(self, now: float) -> None:
        """Drop expired windows so the dict cannot grow without bound."""
        if len(self._windows) < 10_000:
            return
        expired = [
            key
            for key, window in self._windows.items()
            if now - window.started_at >= self._window_seconds
        ]
        for key in expired:
            self._windows.pop(key, None)
