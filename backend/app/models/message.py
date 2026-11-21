"""The job room: the message thread between the client and the provider.

There is no separate chat entity. A job room is the job, and its messages point
at it, which is why authorisation is one join rather than a room membership table.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .base import DemoMarkMixin, TimestampMixin, UuidPrimaryKeyMixin

#: Who a message is from. A system line is written by the agent or by the state
#: machine and is never authored by a person.
MESSAGE_AUTHORS = ("client", "provider", "system", "agent")


class JobMessage(Base, UuidPrimaryKeyMixin, TimestampMixin, DemoMarkMixin):
    """One message in one job room."""

    __tablename__ = "job_messages"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    author_kind: Mapped[str] = mapped_column(String(16), nullable=False, default="client")
    body: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("ix_job_messages_job_created", "job_id", "created_at"),
        Index("ix_job_messages_is_demo", "is_demo"),
    )
