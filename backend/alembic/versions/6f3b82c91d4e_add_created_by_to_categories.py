"""add created_by_id to categories

Revision ID: 6f3b82c91d4e
Revises: 5e2a71b89c3d
Create Date: 2026-11-27 13:30:00.000000
Pure ASCII.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '6f3b82c91d4e'
down_revision = '5e2a71b89c3d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'categories',
        sa.Column(
            'created_by_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
        )
    )


def downgrade() -> None:
    op.drop_column('categories', 'created_by_id')
