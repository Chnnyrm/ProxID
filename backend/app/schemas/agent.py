"""Agent contracts: what the user asks for, and what the agent reports doing."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from .base import OutputModel, TrimmedText


class AgentAction(OutputModel):
    """An actionable choice rendered under an agent reply."""

    id: str
    label: str
    kind: str
    payload: dict[str, Any] | None = None
    target: str | None = None


class AgentRunRequest(TrimmedText):
    """A command to the agent, optionally scoped to one job room."""

    command: str = Field(min_length=1, max_length=2000)
    job_id: uuid.UUID | None = None


class AgentStepOut(OutputModel):
    """One tool call the agent made, as the activity feed shows it."""

    tool: str
    summary: str
    succeeded: bool
    arguments: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    created_at: datetime | None = None


class AgentRunOut(OutputModel):
    """The agent's answer plus the record of what it did to produce it."""

    reply: str
    steps: list[AgentStepOut] = Field(default_factory=list)
    used_tools: list[str] = Field(default_factory=list)
    degraded: bool = False
    actions: list[AgentAction] = Field(default_factory=list)


class AgentTurnOut(OutputModel):
    """A single turn in the persisted conversation thread."""

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    steps: list[AgentStepOut] | None = None
    used_tools: list[str] | None = None
    actions: list[AgentAction] | None = None
    degraded: bool = False
    created_at: datetime


class AgentConversationOut(OutputModel):
    """A user's conversation with historical turns."""

    id: uuid.UUID
    title: str
    turns: list[AgentTurnOut] = Field(default_factory=list)
    created_at: datetime
