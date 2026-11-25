"""Web push subscription persistence.

Stores browser PushManager endpoints and encryption keys so background notifications
can be delivered to subscribed devices.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .base import TimestampMixin, UuidPrimaryKeyMixin


class PushSubscription(Base, UuidPrimaryKeyMixin, TimestampMixin):
    """A browser push subscription belonging to an authenticated user."""

    __tablename__ = "push_subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    keys: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("ix_push_subscriptions_user_created", "user_id", "created_at"),
    )
