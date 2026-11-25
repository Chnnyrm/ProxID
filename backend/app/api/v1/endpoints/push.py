"""Web push subscription endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.config import Settings
from ....schemas.notification import PushPublicKeyOut, PushStatusOut, PushSubscriptionIn
from ....services import notification_service
from ...deps import CurrentUser, get_current_user, get_db, get_settings

router = APIRouter()


@router.get("/vapid-public-key", response_model=PushPublicKeyOut)
async def vapid_public_key(settings: Settings = Depends(get_settings)) -> PushPublicKeyOut:
    """Return the VAPID public key for the browser to create a push subscription."""
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Web Push is not configured on this server.",
        )
    return PushPublicKeyOut(public_key=settings.VAPID_PUBLIC_KEY)


@router.get("/status", response_model=PushStatusOut)
async def push_status(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PushStatusOut:
    """Check whether the current user has active push subscriptions on this server."""
    subscribed, count = await notification_service.get_push_status(db, current_user.id)
    return PushStatusOut(subscribed=subscribed, count=count)


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    payload: PushSubscriptionIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    """Store or update the user's browser push subscription."""
    await notification_service.register_push_subscription(
        db,
        user_id=current_user.id,
        endpoint=payload.endpoint,
        keys=payload.keys,
        user_agent=payload.user_agent,
    )
    return {"status": "subscribed"}
