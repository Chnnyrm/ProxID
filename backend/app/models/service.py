"""A provider's listing: what they offer, where, and for how much.

``location`` is a PostGIS geography point, which is the whole reason the nearby
queries work: geography gives metres directly, so ``ST_DWithin(location, point,
radius_metres)`` needs no projection and no unit conversion.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from geoalchemy2 import Geography
from sqlalchemy import Boolean, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .base import DemoMarkMixin, TimestampMixin, UuidPrimaryKeyMixin


class ServiceListing(Base, UuidPrimaryKeyMixin, TimestampMixin, DemoMarkMixin):
    """One thing a provider offers, at one price, reachable from one point."""

    __tablename__ = "service_listings"

    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    min_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    max_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    location: Mapped[object | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )
    radius_km: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=5)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_service_listings_provider_id", "provider_id"),
        Index("ix_service_listings_category_id", "category_id"),
        Index("ix_service_listings_location", "location", postgresql_using="gist"),
        Index("ix_service_listings_is_demo", "is_demo"),
    )
