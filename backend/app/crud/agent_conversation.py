"""Database operations for agent conversations and turns."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.agent_conversation import AgentConversation, AgentTurn


async def get_or_create_conversation(
    db: AsyncSession, user_id: uuid.UUID, *, is_demo: bool = False
) -> AgentConversation:
    """Retrieve the active conversation for a user or create a new one."""
    stmt = (
        select(AgentConversation)
        .where(AgentConversation.user_id == user_id)
        .order_by(AgentConversation.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if conv is not None:
        return conv

    conv = AgentConversation(
        user_id=user_id,
        title="proxidAI Session",
        is_demo=is_demo,
    )
    db.add(conv)
    await db.flush()
    return conv


async def list_turns(
    db: AsyncSession, conversation_id: uuid.UUID, *, limit: int = 50
) -> list[AgentTurn]:
    """Retrieve turns in chronological order for conversation replay."""
    stmt = (
        select(AgentTurn)
        .where(AgentTurn.conversation_id == conversation_id)
        .order_by(AgentTurn.created_at.asc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_recent_turns_by_user(
    db: AsyncSession, user_id: uuid.UUID, *, limit: int = 10
) -> list[AgentTurn]:
    """Retrieve the most recent turns for context injection (newest first, then reversed)."""
    stmt = (
        select(AgentTurn)
        .where(AgentTurn.user_id == user_id)
        .order_by(AgentTurn.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    turns = list(result.scalars().all())
    turns.reverse()
    return turns


async def add_turn(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    role: str,
    content: str,
    steps: list[dict[str, Any]] | None = None,
    used_tools: list[str] | None = None,
    actions: list[dict[str, Any]] | None = None,
    degraded: bool = False,
    is_demo: bool = False,
) -> AgentTurn:
    """Persist a single turn (user command or agent reply)."""
    turn = AgentTurn(
        conversation_id=conversation_id,
        user_id=user_id,
        role=role,
        content=content,
        steps=steps,
        used_tools=used_tools,
        actions=actions,
        degraded=degraded,
        is_demo=is_demo,
    )
    db.add(turn)
    await db.flush()
    return turn
