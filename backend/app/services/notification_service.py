"""Notification and web push orchestration service.

Encapsulates database operations and web push notifications, keeping routers decoupled from CRUD.
Pure ASCII.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings
from ..crud import notification as notification_crud
from ..crud import push_subscription as push_crud
from ..models.notification import Notification
from ..models.push_subscription import PushSubscription


async def get_push_status(db: AsyncSession, user_id: uuid.UUID) -> tuple[bool, int]:
    """Return whether the user has active push subscriptions and count."""
    subs = await push_crud.list_by_user(db, user_id)
    return len(subs) > 0, len(subs)


async def register_push_subscription(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    endpoint: str,
    keys: dict[str, str],
    user_agent: str | None = None,
) -> PushSubscription:
    """Register or refresh a browser push subscription."""
    return await push_crud.create_or_update(
        db,
        user_id=user_id,
        endpoint=endpoint,
        keys=keys,
        user_agent=user_agent,
    )


async def list_user_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[Notification]:
    """Retrieve user notifications, newest first."""
    return await notification_crud.list_by_user(db, user_id, limit=limit, offset=offset)


async def mark_notification_read(
    db: AsyncSession,
    notification_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    """Mark a user notification as read."""
    return await notification_crud.mark_as_read(db, notification_id, user_id)


async def dispatch_notification(
    db: AsyncSession,
    settings: Settings,
    *,
    user_id: uuid.UUID,
    title: str,
    message: str,
    link: str | None = None,
    type: str = "agent",
    tag: str | None = None,
    actions: list[dict[str, Any]] | None = None,
) -> tuple[Notification, str, bool]:
    """Dispatch an actionable notification.

    Attempts WebPush delivery to active subscriptions; falls back to an in-app
    notification row, and returns (notification, delivery_path, push_delivered).
    """
    push_delivered = await notification_crud.send_web_push(
        db,
        settings,
        user_id,
        title=title,
        message=message,
        link=link,
        type=type,
        actions=actions,
    )

    notif = await notification_crud.create(
        db,
        user_id,
        title=title,
        message=message,
        link=link,
        type=type,
        tag=tag,
        actions=actions,
        push_sent=push_delivered,
    )

    delivery_path = "web_push" if push_delivered else "in_app"
    return notif, delivery_path, push_delivered
