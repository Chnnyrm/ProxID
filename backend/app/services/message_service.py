"""Job room messages, and the one rule that matters: only the two people talk.

The author kind is derived from the sender's relationship to the job, never sent by
the client, so a message cannot claim to be from the agent or the other side.

Posting a message is a critical action by the house standard (it sends something
to someone else), so it writes an audit row, and the room's message count is
incremented in the same transaction as the insert.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.errors import NotFoundError, ValidationError
from ..crud import job as job_crud
from ..crud import message as message_crud
from ..crud import user as user_crud
from ..models.user import User
from ..schemas.message import MessageOut
from .concordium.audit_service import AuditService
from .user_service import to_user_out


class MessageService:
    """Reading and writing job room messages."""

    def __init__(self, audit: AuditService) -> None:
        self._audit = audit

    async def post_message(
        self, db: AsyncSession, actor: User, job_id: uuid.UUID, body: str
    ) -> MessageOut:
        """Post into a room the caller belongs to.

        An empty body is refused before the database sees it. A body over 4000
        characters is refused by the schema. A stranger gets the same answer as a
        missing room.
        """
        cleaned = (body or "").strip()
        if not cleaned:
            raise ValidationError(
                f"send_message refused: empty body for job_id={job_id} (layer=service)",
                operation="send_message",
                external_message="Type a message before sending.",
            )

        job = await job_crud.get_by_id(db, job_id)
        if job is None:
            raise NotFoundError(
                f"send_message failed: job_id={job_id} not found (layer=crud)",
                operation="send_message",
                external_message="We could not find that job room. It may have been removed.",
            )

        if actor.id == job.client_id:
            author_kind = "client"
        elif job.provider_id is not None and actor.id == job.provider_id:
            author_kind = "provider"
        else:
            raise NotFoundError(
                f"send_message denied: actor={actor.id} is not a participant of job_id={job_id} (layer=service)",
                operation="send_message",
                external_message="We could not find that job room. It may have been removed.",
            )

        message = await message_crud.create(
            db,
            job_id=job.id,
            sender_id=actor.id,
            author_kind=author_kind,
            body=cleaned,
            is_demo=job.is_demo,
        )
        # Denormalised so the browse ranking can order by activity without a join.
        job.message_count = (job.message_count or 0) + 1
        await db.flush()

        await self._audit.record(
            db,
            action="send_message",
            subject_type="job",
            subject_id=str(job.id),
            outcome="success",
            actor_id=actor.id,
            detail={"author_kind": author_kind, "length": len(cleaned)},
        )
        return MessageOut(
            id=message.id,
            job_id=message.job_id,
            sender_id=message.sender_id,
            author_kind=message.author_kind,
            body=message.body,
            sender_display_name=actor.display_name,
            is_demo=message.is_demo,
            created_at=message.created_at,
        )

    async def list_messages(
        self, db: AsyncSession, actor: User, job_id: uuid.UUID, *, limit: int, offset: int
    ) -> list[MessageOut]:
        """The thread of a room the caller belongs to."""
        job = await job_crud.get_by_id(db, job_id)
        if job is None or actor.id not in {job.client_id, job.provider_id}:
            raise NotFoundError(
                f"list_messages denied or missing: job_id={job_id} actor={actor.id} (layer=service)",
                operation="list_messages",
                external_message="We could not find that job room. It may have been removed.",
            )
        messages = await message_crud.list_by_job(db, job.id, limit=limit, offset=offset)
        senders = await user_crud.get_many_by_ids(
            db, [message.sender_id for message in messages if message.sender_id is not None]
        )
        return [
            MessageOut(
                id=message.id,
                job_id=message.job_id,
                sender_id=message.sender_id,
                author_kind=message.author_kind,
                body=message.body,
                sender_display_name=(
                    senders[message.sender_id].display_name
                    if message.sender_id and message.sender_id in senders
                    else None
                ),
                is_demo=message.is_demo,
                created_at=message.created_at,
            )
            for message in messages
        ]

    def to_participant(self, user: User):
        """The public shape of a room participant."""
        return to_user_out(user)
