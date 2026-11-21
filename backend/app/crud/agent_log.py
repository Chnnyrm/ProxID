"""Persistence for the agent's tool-call log."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.agent_log import AgentToolLog


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    tool_name: str,
    arguments: dict,
    succeeded: bool,
    summary: str,
    job_id: uuid.UUID | None = None,
    is_demo: bool = False,
) -> AgentToolLog:
    """Insert one tool-call record and flush."""
    entry = AgentToolLog(
        user_id=user_id,
        job_id=job_id,
        tool_name=tool_name,
        arguments=arguments,
        succeeded=succeeded,
        summary=summary,
        is_demo=is_demo,
    )
    db.add(entry)
    await db.flush()
    return entry


async def list_by_user(
    db: AsyncSession, user_id: uuid.UUID, *, limit: int = 50, offset: int = 0
) -> list[AgentToolLog]:
    """One user's most recent tool calls, newest first."""
    result = await db.execute(
        select(AgentToolLog)
        .where(AgentToolLog.user_id == user_id)
        .order_by(AgentToolLog.created_at.desc(), AgentToolLog.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def list_by_job(
    db: AsyncSession, job_id: uuid.UUID, *, limit: int = 50, offset: int = 0
) -> list[AgentToolLog]:
    """The tool calls made inside one job room, newest first."""
    result = await db.execute(
        select(AgentToolLog)
        .where(AgentToolLog.job_id == job_id)
        .order_by(AgentToolLog.created_at.desc(), AgentToolLog.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())
