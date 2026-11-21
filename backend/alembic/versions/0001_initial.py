"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-21

The first migration begins with ``CREATE EXTENSION IF NOT EXISTS postgis`` so it runs
on a managed Postgres that does not have the extension preinstalled, including the Neon
and Supabase free tiers, where an extension can be enabled but not chosen.

The schema carries no Solana wallet column, no cNFT column and no escrow address. Those
belonged to a different chain and a different product. In their place:

- ``users.concordium_account_address``, ``concordium_verified``,
  ``concordium_zk_proof_ref``: the human proof.
- ``users.agent_account_address``, ``agent_verified``: the agent's own scoped identity.
- ``users.cis8004_agent_id``: the agent registration.
- ``jobs.x402_tx_hash``: the settlement hash, written only by a real settlement.
"""

from __future__ import annotations

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostGIS before anything spatial. IF NOT EXISTS so a database that already has it
    # (a self-hosted image, a Supabase project with the extension enabled) is fine.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_categories_name_lower", "categories", ["name"])

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=True),
        sa.Column("google_id", sa.String(255), nullable=True, unique=True),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("phone_number", sa.String(32), nullable=True, unique=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("role", sa.String(16), nullable=False, server_default="client"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("neighbourhood", sa.String(120), nullable=True),
        sa.Column("last_location", geoalchemy2.types.Geography(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        # Concordium, human side.
        sa.Column("concordium_account_address", sa.String(64), nullable=True),
        sa.Column("concordium_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("concordium_zk_proof_ref", sa.String(128), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        # Concordium, agent side: its own identity, never the human's.
        sa.Column("cis8004_agent_id", sa.String(128), nullable=True),
        sa.Column("agent_account_address", sa.String(64), nullable=True),
        sa.Column("agent_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("agent_verification_ref", sa.String(128), nullable=True),
        sa.Column("agent_card_url", sa.Text(), nullable=True),
        sa.Column("agent_autonomy_level", sa.String(16), nullable=False, server_default="off"),
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_latitude_longitude", "users", ["latitude", "longitude"])
    op.create_index("ix_users_concordium_verified", "users", ["concordium_verified"])
    op.create_index("ix_users_last_location", "users", ["last_location"], postgresql_using="gist")
    op.create_index("ix_users_is_demo", "users", ["is_demo"])

    op.create_table(
        "user_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])

    op.create_table(
        "service_listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "provider_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("min_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("max_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("location", geoalchemy2.types.Geography(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("radius_km", sa.Numeric(6, 2), nullable=False, server_default="5"),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_service_listings_provider_id", "service_listings", ["provider_id"])
    op.create_index("ix_service_listings_category_id", "service_listings", ["category_id"])
    op.create_index("ix_service_listings_location", "service_listings", ["location"], postgresql_using="gist")
    op.create_index("ix_service_listings_is_demo", "service_listings", ["is_demo"])

    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "provider_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "service_listing_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_listings.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("min_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("max_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("status", sa.String(24), nullable=False, server_default="open"),
        sa.Column("location", geoalchemy2.types.Geography(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("x402_tx_hash", sa.String(128), nullable=True),
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('open','requested','assigned','in_progress','completed','cancelled','disputed')",
            name="ck_jobs_status",
        ),
    )
    op.create_index("ix_jobs_status", "jobs", ["status"])
    op.create_index("ix_jobs_client_id", "jobs", ["client_id"])
    op.create_index("ix_jobs_provider_id", "jobs", ["provider_id"])
    op.create_index("ix_jobs_location", "jobs", ["location"], postgresql_using="gist")
    op.create_index("ix_jobs_is_demo", "jobs", ["is_demo"])

    op.create_table(
        "job_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("author_kind", sa.String(16), nullable=False, server_default="client"),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_job_messages_job_created", "job_messages", ["job_id", "created_at"])
    op.create_index("ix_job_messages_is_demo", "job_messages", ["is_demo"])

    op.create_table(
        "agent_tool_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("tool_name", sa.String(64), nullable=False),
        sa.Column("arguments", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("succeeded", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_agent_tool_logs_user_created", "agent_tool_logs", ["user_id", "created_at"])
    op.create_index("ix_agent_tool_logs_job_id", "agent_tool_logs", ["job_id"])
    op.create_index("ix_agent_tool_logs_is_demo", "agent_tool_logs", ["is_demo"])

    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("subject_type", sa.String(32), nullable=False),
        sa.Column("subject_id", sa.String(64), nullable=True),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("detail", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("correlation_id", sa.String(64), nullable=True),
        sa.Column("client_ip", sa.String(64), nullable=True),
        # Article 12 pattern: the nonce salts the hash, and only the hash is anchored.
        sa.Column("record_nonce", sa.String(64), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("anchor_tx_hash", sa.String(128), nullable=True),
        sa.Column("anchored_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audit_events_action_created", "audit_events", ["action", "created_at"])
    op.create_index("ix_audit_events_actor_id", "audit_events", ["actor_id"])
    op.create_index("ix_audit_events_subject", "audit_events", ["subject_type", "subject_id"])

    op.create_table(
        "verification_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("purpose", sa.String(32), nullable=False, server_default="personhood"),
        sa.Column("bound_domain", sa.String(255), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("nonce", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("qr_payload", sa.Text(), nullable=True),
        sa.Column("request_anchor_ref", sa.String(128), nullable=True),
        sa.Column("audit_anchor_ref", sa.String(128), nullable=True),
        sa.Column("zk_proof_ref", sa.String(128), nullable=True),
        sa.Column("outcome_detail", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending','approved','rejected','expired','consumed','demo_approved')",
            name="ck_verification_requests_status",
        ),
    )
    op.create_index("ix_verification_requests_user_id", "verification_requests", ["user_id"])
    op.create_index(
        "ix_verification_requests_status_expires", "verification_requests", ["status", "expires_at"]
    )
    op.create_index("ix_verification_requests_is_demo", "verification_requests", ["is_demo"])

    op.create_table(
        "x402_receipts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "payer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "payee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("status", sa.String(24), nullable=False, server_default="not_configured"),
        sa.Column("network", sa.String(16), nullable=False, server_default="concordium"),
        sa.Column("network_caip2", sa.String(64), nullable=True),
        sa.Column("asset", sa.String(32), nullable=True),
        sa.Column("fee_payer", sa.String(64), nullable=True),
        sa.Column("requirements", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("x402_tx_hash", sa.String(128), nullable=True),
        sa.Column("payer_account", sa.String(64), nullable=True),
        sa.Column("payee_account", sa.String(64), nullable=True),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=True, unique=True),
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('not_configured','pending','settled','failed','demo')",
            name="ck_x402_receipts_status",
        ),
    )
    op.create_index("ix_x402_receipts_job_id", "x402_receipts", ["job_id"])
    op.create_index("ix_x402_receipts_is_demo", "x402_receipts", ["is_demo"])


def downgrade() -> None:
    """Drop everything this migration created.

    The PostGIS extension is left in place: it may be shared with other schemas, and
    dropping it would take their spatial columns with it.
    """
    op.drop_table("x402_receipts")
    op.drop_table("verification_requests")
    op.drop_table("audit_events")
    op.drop_table("agent_tool_logs")
    op.drop_table("job_messages")
    op.drop_table("jobs")
    op.drop_table("service_listings")
    op.drop_table("user_sessions")
    op.drop_table("users")
    op.drop_table("categories")
