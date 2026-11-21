"""The person using the product, and the session they hold.

The Concordium columns are the Concordium replacement for the Solana wallet and
cNFT columns the predecessor schema carried. They are nullable on purpose: a
user exists before they ever touch the chain, and no proof or address exists
until the identity service is configured.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base
from .base import DemoMarkMixin, TimestampMixin, UuidPrimaryKeyMixin

USER_ROLES = ("client", "provider", "both")


class User(Base, UuidPrimaryKeyMixin, TimestampMixin, DemoMarkMixin):
    """A marketplace participant.

    ``concordium_verified`` is the product's central promise: a provider who has
    proven, without revealing who they are, that they are a unique human. It is
    false for everyone until the identity service is configured, and it is never
    inferred from anything else.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="client")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Last known position, used to rank providers and jobs by distance.
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    neighbourhood: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # The same position as a PostGIS geography point. Provider proximity is a
    # spheroid distance (ST_DistanceSphere), which needs the geometry.
    last_location: Mapped[object | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # -- Concordium ----------------------------------------------------------
    concordium_account_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # True only after a zero-knowledge proof reference has been stored below.
    concordium_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Opaque reference to the proof the identity service issued. Never the proof
    # itself: the point of the proof is that it is not retained here.
    concordium_zk_proof_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # CIS-8004 agent registration, for accounts that act as an agent. (The
    # workshops call the same standard CIS-804; the documented name is used in code
    # and the name is kept out of user-facing copy until it is confirmed.)
    cis8004_agent_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # The agent holds its own scoped identity, distinct from the human's: its own
    # account address and its own verification status. Concordium's Agent IDP issues
    # that credential after the human reveals one attribute with a zero-knowledge
    # proof, so the agent never borrows the human's master identity. Agent IDP is
    # DevNet only, so these stay null.
    agent_account_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    agent_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    agent_verification_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # URL of the agent card the on-chain registration points at.
    agent_card_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    agent_autonomy_level: Mapped[str] = mapped_column(
        String(16), nullable=False, default="off", server_default="off"
    )

    __table_args__ = (
        Index("ix_users_latitude_longitude", "latitude", "longitude"),
        Index("ix_users_concordium_verified", "concordium_verified"),
        Index("ix_users_last_location", "last_location", postgresql_using="gist"),
        Index("ix_users_is_demo", "is_demo"),
    )


class UserSession(Base, UuidPrimaryKeyMixin):
    """A server-side session record, so logout actually invalidates the token.

    The token itself carries the ``jti``; this row is what makes it revocable.
    """

    __tablename__ = "user_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    __table_args__ = (Index("ix_user_sessions_user_id", "user_id"),)
