"""Database operations and delivery routines for notifications and web push."""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Any

from pywebpush import WebPushException, webpush
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings
from ..core.logging import get_logger
from ..models.notification import Notification
from ..models.push_subscription import PushSubscription

logger = get_logger("notification")


async def create(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    title: str,
    message: str,
    link: str | None = None,
    type: str = "system",
    tag: str | None = None,
    actions: list[dict[str, Any]] | None = None,
    push_sent: bool = False,
) -> Notification:
    """Create a persistent in-app notification row."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        link=link,
        type=type,
        tag=tag,
        actions=actions,
        push_sent=push_sent,
    )
    db.add(notif)
    await db.flush()
    return notif


async def list_by_user(
    db: AsyncSession, user_id: uuid.UUID, *, limit: int = 50, offset: int = 0
) -> list[Notification]:
    """Retrieve notifications for a user, newest first."""
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def mark_as_read(
    db: AsyncSession, notification_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    """Mark a notification as read."""
    stmt = (
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user_id)
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.flush()
    return bool(result.rowcount and result.rowcount > 0)


async def send_web_push(
    db: AsyncSession,
    settings: Settings,
    user_id: uuid.UUID,
    *,
    title: str,
    message: str,
    link: str | None = None,
    type: str = "system",
    tag: str | None = None,
    actions: list[dict[str, Any]] | None = None,
) -> bool:
    """Send web push notifications to all registered devices of a user."""
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.info("web push skipped: VAPID keys not configured")
        return False

    stmt = select(PushSubscription).where(PushSubscription.user_id == user_id)
    result = await db.execute(stmt)
    subs = list(result.scalars().all())
    if not subs:
        return False

    base_payload = {
        "title": title,
        "body": message,
        "url": link or "/",
        "type": type,
        "icon": "/icon.png",
        "badge": "/icon.png",
        "vibrate": [100, 50, 100],
        "timestamp": int(time.time() * 1000),
    }
    if tag:
        base_payload["tag"] = tag
    if actions:
        base_payload["actions"] = actions[:2]

    any_delivered = False
    for sub in subs:
        sub_info = {
            "endpoint": sub.endpoint,
            "keys": sub.keys,
        }
        payload_json = json.dumps(base_payload)
        try:
            await asyncio.to_thread(
                webpush,
                subscription_info=sub_info,
                data=payload_json,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
            )
            any_delivered = True
        except WebPushException as ex:
            logger.warning(
                "web push delivery failed",
                extra={"endpoint": sub.endpoint, "status": ex.response.status_code if ex.response else None},
            )
            if ex.response and ex.response.status_code == 410:
                await db.delete(sub)
                await db.flush()
        except Exception as exc:
            logger.warning("web push exception", extra={"error": str(exc)})

    return any_delivered
