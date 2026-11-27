"""add image_urls to service_listings and jobs

Revision ID: 5e2a71b89c3d
Revises: 4d1b82e99f1a
Create Date: 2026-11-27 13:15:00.000000
Pure ASCII.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '5e2a71b89c3d'
down_revision = '4d1b82e99f1a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'service_listings',
        sa.Column('image_urls', sa.JSON(), nullable=False, server_default='[]')
    )
    op.add_column(
        'jobs',
        sa.Column('image_urls', sa.JSON(), nullable=False, server_default='[]')
    )
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "UPDATE service_listings SET image_urls = json_build_array(image_url) "
            "WHERE image_url IS NOT NULL AND (image_urls IS NULL OR image_urls::text = '[]');"
        )
        op.execute(
            "UPDATE jobs SET image_urls = json_build_array(image_url) "
            "WHERE image_url IS NOT NULL AND (image_urls IS NULL OR image_urls::text = '[]');"
        )


def downgrade() -> None:
    op.drop_column('jobs', 'image_urls')
    op.drop_column('service_listings', 'image_urls')
