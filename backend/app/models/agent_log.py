"""One entry per agent tool call, so the agent's actions are reviewable.

Ported from the tool-calling loop's activity log, minus everything wallet or
memory related. A row here is the reason a person can see what the agent did on
their behalf instead of taking the agent's summary on trust.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .base import DemoMarkMixin, TimestampMixin, UuidPrimaryKeyMixin


class AgentToolLog(Base, UuidPrimaryKeyMixin, TimestampMixin, DemoMarkMixin):
    """A single tool invocation: which tool, with what arguments, and what came back."""

    __tablename__ = "agent_tool_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True
    )
    tool_name: Mapped[str] = mapped_column(String(64), nullable=False)
    arguments: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    succeeded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # One short sentence for the activity feed, never the whole tool result.
    summary: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("ix_agent_tool_logs_user_created", "user_id", "created_at"),
        Index("ix_agent_tool_logs_job_id", "job_id"),
        Index("ix_agent_tool_logs_is_demo", "is_demo"),
    )
