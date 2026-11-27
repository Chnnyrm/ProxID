"""add onboarded to users

Revision ID: 4d1b82e99f1a
Revises: 243e8757dbaf
Create Date: 2026-11-27 09:45:00.000000
Pure ASCII.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '4d1b82e99f1a'
down_revision = '243e8757dbaf'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('onboarded', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('users', 'onboarded')
