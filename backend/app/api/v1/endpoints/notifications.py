"""User notification endpoints with web push and in-app fallback."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.config import Settings
from ....schemas.notification import NotificationOut, TestNotificationIn
from ....services import notification_service
from ...deps import CurrentUser, get_current_user, get_db, get_settings

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[NotificationOut]:
    """Retrieve notifications for the current user, newest first."""
    rows = await notification_service.list_user_notifications(
        db, current_user.id, limit=limit, offset=offset
    )
    return [
        NotificationOut(
            id=row.id,
            title=row.title,
            message=row.message,
            link=row.link,
            type=row.type,
            tag=row.tag,
            actions=row.actions,
            is_read=row.is_read,
            push_sent=row.push_sent,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.patch(
    "/{notification_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    """Mark a notification as read.

    Returns an empty 204. Annotating this ``-> None`` makes FastAPI build a JSON
    response model for it, then assert at import time that a 204 must not carry a
    body, which aborts the whole application on startup with
    FUNCTION_INVOCATION_FAILED. An explicit empty Response avoids the body.
    """
    success = await notification_service.mark_notification_read(
        db, notification_id, current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test", status_code=status.HTTP_201_CREATED)
async def trigger_test_notification(
    payload: TestNotificationIn,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Send an actionable notification composed by the agent.

    Attempts WebPush delivery to active subscriptions; falls back to an in-app
    notification row, and states which path was used.
    """
    notif, delivery_path, push_delivered = await notification_service.dispatch_notification(
        db,
        settings,
        user_id=current_user.id,
        title=payload.title,
        message=payload.message,
        link=payload.link,
        type=payload.type,
        actions=payload.actions,
    )

    return {
        "status": "ok",
        "delivery_path": delivery_path,
        "notification_id": str(notif.id),
        "push_delivered": push_delivered,
    }
