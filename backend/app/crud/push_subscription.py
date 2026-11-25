"""Database operations for web push subscriptions."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.push_subscription import PushSubscription


async def create_or_update(
    db: AsyncSession,
    user_id: uuid.UUID,
    endpoint: str,
    keys: dict[str, Any],
    user_agent: str | None = None,
) -> PushSubscription:
    """Store a browser push subscription for a user."""
    stmt = select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.user_id = user_id
        existing.keys = keys
        existing.user_agent = user_agent
        await db.flush()
        return existing

    sub = PushSubscription(
        user_id=user_id,
        endpoint=endpoint,
        keys=keys,
        user_agent=user_agent,
    )
    db.add(sub)
    await db.flush()
    return sub


async def list_by_user(
    db: AsyncSession, user_id: uuid.UUID
) -> list[PushSubscription]:
    """Retrieve all registered push subscriptions for a user."""
    stmt = (
        select(PushSubscription)
        .where(PushSubscription.user_id == user_id)
        .order_by(PushSubscription.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def delete_by_endpoint(db: AsyncSession, endpoint: str) -> None:
    """Remove an expired or revoked subscription."""
    stmt = delete(PushSubscription).where(PushSubscription.endpoint == endpoint)
    await db.execute(stmt)
    await db.flush()
