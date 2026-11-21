"""Job room message contracts."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from .base import InputModel, OutputModel, TrimmedText


class MessageCreate(TrimmedText):
    """Post into a job room.

    There is deliberately no ``author_kind`` field: the server derives it from
    the sender's relationship to the job, so a client cannot post as the agent.
    """

    body: str = Field(min_length=1, max_length=4000)


class MessageOut(OutputModel):
    """One message in a room."""

    id: uuid.UUID
    job_id: uuid.UUID
    sender_id: uuid.UUID | None = None
    author_kind: str
    body: str
    sender_display_name: str | None = None
    is_demo: bool = False
    created_at: datetime
