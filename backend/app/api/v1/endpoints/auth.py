"""Sign-in routes: register, login, Google, the judge demo, logout.

Each route parses, calls one service, and shapes the response. No branch here makes
a decision the service should make.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....core.errors import NotConfiguredError
from ....schemas.base import MessageOnly
from ....schemas.user import GoogleCredential, SessionOut, UserLogin, UserRegister
from ...deps import (
    clear_session_cookies,
    get_client_ip,
    get_container,
    get_current_user,
    get_db,
    set_session_cookies,
    CurrentUser,
)

router = APIRouter()


@router.post("/register", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserRegister,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> SessionOut:
    """Create an account and sign straight in.

    The message for a duplicate email is the one place this endpoint says whether an
    account exists, because "sign in instead" is the only useful next step for a
    person who already registered.
    """
    issued = await container.auth.register(
        db, payload, user_agent=request.headers.get("user-agent")
    )
    await container.concordium.audit.record(
        db,
        action="register_user",
        subject_type="user",
        subject_id=str(issued.user.id),
        outcome="success",
        actor_id=issued.user.id,
        client_ip=get_client_ip(request),
    )
    set_session_cookies(
        response, token=issued.token, expires_at=issued.expires_at, settings=container.settings
    )
    return await container.auth.session_payload(db, issued)


@router.post("/login", response_model=SessionOut)
async def login(
    payload: UserLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> SessionOut:
    """Sign in with an email and a password."""
    issued = await container.auth.login(
        db, payload.email, payload.password, user_agent=request.headers.get("user-agent")
    )
    await container.concordium.audit.record(
        db,
        action="login_user",
        subject_type="user",
        subject_id=str(issued.user.id),
        outcome="success",
        actor_id=issued.user.id,
        client_ip=get_client_ip(request),
    )
    set_session_cookies(
        response, token=issued.token, expires_at=issued.expires_at, settings=container.settings
    )
    return await container.auth.session_payload(db, issued)


@router.post("/google", response_model=SessionOut)
async def google(
    payload: GoogleCredential,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> SessionOut:
    """Sign in with the access token the Google button returns."""
    issued = await container.auth.login_with_google(
        db, payload.access_token, user_agent=request.headers.get("user-agent")
    )
    await container.concordium.audit.record(
        db,
        action="google_sign_in",
        subject_type="user",
        subject_id=str(issued.user.id),
        outcome="success",
        actor_id=issued.user.id,
        client_ip=get_client_ip(request),
    )
    set_session_cookies(
        response, token=issued.token, expires_at=issued.expires_at, settings=container.settings
    )
    return await container.auth.session_payload(db, issued)


@router.post("/demo-login", response_model=SessionOut)
async def demo_login(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
) -> SessionOut:
    """Sign into the seeded judge profile. No OAuth, no wallet, no password.

    The route is always mounted so a client's generated types do not change with a
    deployment's flags, and it refuses with a plain sentence when
    ``FEATURE_JUDGE_DEMO`` is off. The account it signs into is marked ``is_demo`` in
    the database, so everything reachable from it says so.
    """
    if not container.settings.FEATURE_JUDGE_DEMO:
        raise NotConfiguredError("the judge demo", operation="demo_login")
    issued = await container.auth.demo_login(
        db, user_agent=request.headers.get("user-agent")
    )
    await container.concordium.audit.record(
        db,
        action="demo_login",
        subject_type="user",
        subject_id=str(issued.user.id),
        outcome="success",
        actor_id=issued.user.id,
        detail={"demo": True},
        client_ip=get_client_ip(request),
    )
    set_session_cookies(
        response, token=issued.token, expires_at=issued.expires_at, settings=container.settings
    )
    return await container.auth.session_payload(db, issued)


@router.post("/logout", response_model=MessageOnly)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> MessageOnly:
    """End the session on the server and clear the cookies."""
    token = request.cookies.get(container.settings.SESSION_COOKIE_NAME) or request.headers.get(
        "authorization", ""
    ).removeprefix("Bearer ").strip()
    await container.auth.logout(db, token)
    await container.concordium.audit.record(
        db,
        action="logout",
        subject_type="user",
        subject_id=str(current_user.id),
        outcome="success",
        actor_id=current_user.id,
        client_ip=get_client_ip(request),
    )
    clear_session_cookies(response, container.settings)
    return MessageOnly(message="You are signed out.")
