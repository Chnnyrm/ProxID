"""Persistence for job room messages."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.message import JobMessage


async def list_by_job(
    db: AsyncSession, job_id: uuid.UUID, *, limit: int = 100, offset: int = 0
) -> list[JobMessage]:
    """One job room's messages, oldest first.

    Oldest first because a conversation reads that way; the limit is bounded by the
    router so a room cannot return an unbounded list.
    """
    result = await db.execute(
        select(JobMessage)
        .where(JobMessage.job_id == job_id)
        .order_by(JobMessage.created_at.asc(), JobMessage.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    job_id: uuid.UUID,
    sender_id: uuid.UUID | None,
    author_kind: str,
    body: str,
    is_demo: bool = False,
) -> JobMessage:
    """Insert one message and flush."""
    message = JobMessage(
        job_id=job_id,
        sender_id=sender_id,
        author_kind=author_kind,
        body=body.strip(),
        is_demo=is_demo,
    )
    db.add(message)
    await db.flush()
    return message


async def count_by_job(db: AsyncSession, job_id: uuid.UUID) -> int:
    """How many messages one job room holds, counted in the query."""
    result = await db.execute(
        select(func.count(JobMessage.id)).where(JobMessage.job_id == job_id)
    )
    return int(result.scalar_one() or 0)
