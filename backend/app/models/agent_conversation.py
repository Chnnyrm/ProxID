"""Agent conversation and turn persistence for long-term memory.

Stores conversational context so an agent has continuous memory across sessions,
remembers previous instructions, and tracks tool calls and actionable choices.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Boolean, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base
from .base import DemoMarkMixin, TimestampMixin, UuidPrimaryKeyMixin


class AgentConversation(Base, UuidPrimaryKeyMixin, TimestampMixin, DemoMarkMixin):
    """A persistent conversation session belonging to a user."""

    __tablename__ = "agent_conversations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Conversation")

    turns: Mapped[list[AgentTurn]] = relationship(
        "AgentTurn",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AgentTurn.created_at",
    )

    __table_args__ = (
        Index("ix_agent_conversations_user_created", "user_id", "created_at"),
        Index("ix_agent_conversations_is_demo", "is_demo"),
    )


class AgentTurn(Base, UuidPrimaryKeyMixin, TimestampMixin, DemoMarkMixin):
    """One turn in an agent conversation (user prompt or assistant reply with tool executions)."""

    __tablename__ = "agent_turns"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agent_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    steps: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    used_tools: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    actions: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    degraded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    conversation: Mapped[AgentConversation] = relationship(
        "AgentConversation", back_populates="turns"
    )

    __table_args__ = (
        Index("ix_agent_turns_conv_created", "conversation_id", "created_at"),
        Index("ix_agent_turns_user_created", "user_id", "created_at"),
        Index("ix_agent_turns_is_demo", "is_demo"),
    )
