"""Job contracts, including the job room view."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from .common import InputModel, Money, OutputModel, TrimmedText
from .message import MessageOut
from .user import UserOut

JobStatus = Literal[
    "open", "requested", "assigned", "in_progress", "completed", "cancelled", "disputed"
]


class JobCreate(TrimmedText):
    """Post a job. Only the client's own fields are settable."""

    title: str = Field(min_length=4, max_length=160)
    description: str = Field(min_length=10, max_length=4000)
    price: Money | None = None
    min_price: Money | None = None
    max_price: Money | None = None
    category_id: uuid.UUID | None = None
    service_listing_id: uuid.UUID | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    image_url: str | None = Field(default=None, max_length=2048)
    scheduled_for: datetime | None = None

    @model_validator(mode="after")
    def _require_a_budget(self) -> "JobCreate":
        if self.price is None and self.min_price is None and self.max_price is None:
            raise ValueError("Set a budget, or a minimum and maximum, so providers know what it pays.")
        if self.min_price is not None and self.max_price is not None and self.max_price < self.min_price:
            raise ValueError("The maximum budget cannot be lower than the minimum budget.")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Send both a latitude and a longitude, or neither.")
        return self


class JobStatusUpdate(InputModel):
    """Ask for a state transition. The service decides whether it is legal."""

    status: Literal["assigned", "in_progress", "completed", "cancelled"]
    provider_id: uuid.UUID | None = None


class JobOut(OutputModel):
    """A job in a list or on a detail page."""

    id: uuid.UUID
    client_id: uuid.UUID
    provider_id: uuid.UUID | None = None
    service_listing_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    category_name: str | None = None
    title: str
    description: str | None = None
    price: float
    min_price: float | None = None
    max_price: float | None = None
    currency: str
    status: str
    latitude: float | None = None
    longitude: float | None = None
    image_url: str | None = None
    distance_km: float | None = None
    client_display_name: str | None = None
    provider_display_name: str | None = None
    x402_tx_hash: str | None = None
    is_demo: bool = False
    created_at: datetime
    updated_at: datetime


class JobRoomOut(OutputModel):
    """One job room: the job, the two people, and the thread."""

    job: JobOut
    client: UserOut
    provider: UserOut | None = None
    messages: list[MessageOut]
    #: Present when a payment record exists for this job. Its status says whether
    #: anything actually moved.
    payment_status: str | None = None
