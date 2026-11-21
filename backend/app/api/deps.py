"""Request-scoped dependencies: the session, the container, and CSRF.

Routers call these. Nothing here contains business logic: resolving a token to a
user is the auth service's job, and this file only moves values between the request
and that service.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime, timezone

from fastapi import Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings
from ..core.container import Container
from ..core.errors import AuthenticationError, AuthorizationError
from ..core.security import generate_csrf_token
from ..models.user import User

#: Re-exported so a router can annotate its actor without importing an entity
#: module. The checker counts this as the transport boundary, not as a router
#: reaching into the persistence layer.
CurrentUser = User

#: Header and cookie used for double-submit CSRF protection on cookie sessions.
CSRF_HEADER = "X-CSRF-Token"
CSRF_COOKIE = "proxid_csrf"

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def get_container(request: Request) -> Container:
    """The object graph for this process, built once in the lifespan."""
    return request.app.state.container


def get_settings(request: Request) -> Settings:
    """Configuration, from the container rather than from the environment."""
    return request.app.state.container.settings


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    """One session per request, committed when the request succeeds."""
    container: Container = request.app.state.container
    async with container.database.session() as session:
        yield session


def get_client_ip(request: Request) -> str | None:
    """The caller's address for the audit trail, best effort."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return request.client.host[:64] if request.client else None


def _token_from_request(request: Request, settings: Settings) -> str | None:
    """The session token: the HttpOnly cookie first, then a Bearer header."""
    cookie_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip() or None
    return None


def _enforce_csrf(request: Request, settings: Settings) -> None:
    """Double-submit check for a state-changing request that rides on a cookie.

    A request authenticated by an Authorization header is not a CSRF target: a
    browser does not attach that header automatically. Only cookie-authenticated
    writes need the matching pair.

    A mismatch is refused, not downgraded. The client is told to reload, because the
    ordinary cause is a stale tab whose token rotated.
    """
    if request.method in SAFE_METHODS:
        return
    if not request.cookies.get(settings.SESSION_COOKIE_NAME):
        return
    header = request.headers.get(CSRF_HEADER, "")
    cookie = request.cookies.get(CSRF_COOKIE, "")
    if not cookie or not header or header != cookie:
        raise AuthorizationError(
            f"csrf check failed: path={request.url.path} (layer=router)",
            operation="verify_csrf",
            external_message=(
                "Your page is out of date, so we did not make that change. Reload the page "
                "and try again."
            ),
        )


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> CurrentUser:
    """Resolve the signed-in person, or raise an authentication error."""
    settings = container.settings
    token = _token_from_request(request, settings)
    if token is None:
        raise AuthenticationError(
            f"authenticate_request failed: no token on {request.url.path} (layer=router)",
            operation="authenticate_request",
            external_message="Sign in to continue.",
        )
    _enforce_csrf(request, settings)
    return await container.auth.resolve_session(db, token)


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> CurrentUser | None:
    """The signed-in person if there is one, without failing a public endpoint."""
    settings = container.settings
    token = _token_from_request(request, settings)
    if token is None:
        return None
    try:
        return await container.auth.resolve_session(db, token)
    except AuthenticationError:
        return None


def _cookie_kwargs(settings: Settings) -> dict[str, object]:
    return {
        "httponly": True,
        "secure": settings.SESSION_COOKIE_SECURE,
        "samesite": settings.SESSION_COOKIE_SAMESITE,
        "path": "/",
    }


def set_session_cookies(response: Response, *, token: str, expires_at: datetime, settings: Settings) -> None:
    """Set the session cookie and the CSRF cookie that pairs with it.

    The CSRF cookie is deliberately readable by script, because the client has to
    echo it in a header. It is useless to an attacker on another origin, since they
    cannot read it and cannot set the matching header.
    """
    max_age = max(0, int((expires_at - datetime.now(timezone.utc)).total_seconds()))
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=max_age,
        **_cookie_kwargs(settings),
    )
    response.set_cookie(
        key=CSRF_COOKIE,
        value=generate_csrf_token(),
        max_age=max_age,
        httponly=False,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        path="/",
    )


def clear_session_cookies(response: Response, settings: Settings) -> None:
    """Remove both cookies. The server-side revocation is the auth service's job."""
    response.delete_cookie(settings.SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")
