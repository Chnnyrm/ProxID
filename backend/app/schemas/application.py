"""Job application schemas.
Pure ASCII.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from .base import Money, OutputModel, TrimmedText


class ApplicationCreate(TrimmedText):
    """Payload to apply for an open job."""

    message: str | None = Field(default=None, max_length=2000)
    proposed_price: Money | None = None


class ApplicationOut(OutputModel):
    """An application record."""

    id: uuid.UUID
    job_id: uuid.UUID
    applicant_id: uuid.UUID
    message: str | None = None
    proposed_price: float | None = None
    status: str
    applicant_display_name: str | None = None
    applicant_avatar_url: str | None = None
    applicant_username: str | None = None
    applicant_concordium_verified: bool = False
    created_at: datetime
