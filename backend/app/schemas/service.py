"""Service listing contracts."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field, model_validator

from .base import InputModel, Money, OutputModel, TrimmedText


class ServiceCreate(TrimmedText):
    """Publish a listing.

    A price range is optional; when only a range is given the effective price is
    the lower bound, which is what a client sees as "from".
    """

    title: str = Field(min_length=4, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    category_id: uuid.UUID | None = None
    price: Money | None = None
    min_price: Money | None = None
    max_price: Money | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_km: float = Field(default=5, gt=0, le=100)
    image_url: str | None = Field(default=None, max_length=2048)

    @model_validator(mode="after")
    def _require_a_price(self) -> "ServiceCreate":
        if self.price is None and self.min_price is None and self.max_price is None:
            raise ValueError("Set a price, or a minimum and maximum, so clients know what this costs.")
        if self.min_price is not None and self.max_price is not None and self.max_price < self.min_price:
            raise ValueError("The maximum price cannot be lower than the minimum price.")
        return self


class ServiceUpdate(TrimmedText):
    """Change part of a listing. Omitted fields keep their value."""

    title: str | None = Field(default=None, min_length=4, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    category_id: uuid.UUID | None = None
    price: Money | None = None
    min_price: Money | None = None
    max_price: Money | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    radius_km: float | None = Field(default=None, gt=0, le=100)
    image_url: str | None = Field(default=None, max_length=2048)
    is_active: bool | None = None


class ServiceOut(OutputModel):
    """A listing as the map and the search list need it.

    Coordinates are resolved from the PostGIS geometry by the service, so the
    client never has to parse WKT.
    """

    id: uuid.UUID
    provider_id: uuid.UUID
    category_id: uuid.UUID | None = None
    category_name: str | None = None
    title: str
    description: str | None = None
    price: float
    min_price: float | None = None
    max_price: float | None = None
    currency: str
    latitude: float | None = None
    longitude: float | None = None
    radius_km: float
    image_url: str | None = None
    is_active: bool
    distance_km: float | None = None
    provider_display_name: str | None = None
    provider_avatar_url: str | None = None
    provider_concordium_verified: bool = False
    is_demo: bool = False
    created_at: datetime
