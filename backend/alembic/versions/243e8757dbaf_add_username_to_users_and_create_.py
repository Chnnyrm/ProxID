"""add username to users and create applications table

Revision ID: 243e8757dbaf
Revises: 3ca6ebffacfb
Create Date: 2026-11-25 02:18:40.535675
Pure ASCII.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '243e8757dbaf'
down_revision = '3ca6ebffacfb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'applications',
        sa.Column('job_id', sa.UUID(), nullable=False),
        sa.Column('applicant_id', sa.UUID(), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('proposed_price', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('status', sa.String(length=24), nullable=False, server_default='pending'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['applicant_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'applicant_id', name='uq_applications_job_applicant'),
    )
    op.create_index('ix_applications_applicant_id', 'applications', ['applicant_id'], unique=False)
    op.create_index('ix_applications_job_id', 'applications', ['job_id'], unique=False)
    op.create_index('ix_applications_status', 'applications', ['status'], unique=False)
    op.add_column('users', sa.Column('username', sa.String(length=60), nullable=True))
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_column('users', 'username')
    op.drop_index('ix_applications_status', table_name='applications')
    op.drop_index('ix_applications_job_id', table_name='applications')
    op.drop_index('ix_applications_applicant_id', table_name='applications')
    op.drop_table('applications')
