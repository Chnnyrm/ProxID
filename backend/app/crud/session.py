"""Persistence for server-side sessions, which is what makes logout real."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import UserSession


async def create(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    issued_at: datetime,
    expires_at: datetime,
    user_agent: str | None = None,
) -> UserSession:
    """Record a session the token's ``jti`` refers to."""
    session = UserSession(
        id=session_id,
        user_id=user_id,
        issued_at=issued_at,
        expires_at=expires_at,
        user_agent=(user_agent or "")[:255] or None,
    )
    db.add(session)
    await db.flush()
    return session


async def get_revoked_ids(db: AsyncSession, session_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    """Which of these sessions are revoked or expired, answered in one query."""
    if not session_ids:
        return set()
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(UserSession.id).where(
            UserSession.id.in_(session_ids),
            (UserSession.revoked_at.isnot(None)) | (UserSession.expires_at <= now),
        )
    )
    return set(result.scalars().all())


async def get_active(db: AsyncSession, session_id: uuid.UUID) -> UserSession | None:
    """One session that is neither revoked nor expired, or None."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
    )
    return result.scalar_one_or_none()


async def revoke(db: AsyncSession, session_id: uuid.UUID) -> bool:
    """Revoke one session. Returns True when a live session was actually revoked."""
    result = await db.execute(
        update(UserSession)
        .where(UserSession.id == session_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    return bool(result.rowcount)


async def revoke_all_for_user(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Revoke every live session a person holds. Used when a password changes."""
    result = await db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    return int(result.rowcount or 0)
