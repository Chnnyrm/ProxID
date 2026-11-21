"""Agent contracts: what the user asks for, and what the agent reports doing."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from .base import InputModel, OutputModel, TrimmedText


class AgentRunRequest(TrimmedText):
    """A command to the agent, optionally scoped to one job room."""

    command: str = Field(min_length=1, max_length=2000)
    job_id: uuid.UUID | None = None


class AgentStepOut(OutputModel):
    """One tool call the agent made, as the activity feed shows it."""

    tool: str
    summary: str
    succeeded: bool
    created_at: datetime | None = None


class AgentRunOut(OutputModel):
    """The agent's answer plus the record of what it did to produce it."""

    reply: str
    steps: list[AgentStepOut] = Field(default_factory=list)
    used_tools: list[str] = Field(default_factory=list)
    #: True when the model was unavailable and a rule-based answer was given.
    degraded: bool = False
