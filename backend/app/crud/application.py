"""CRUD operations for job applications.
Pure ASCII.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.application import Application


async def create(
    db: AsyncSession,
    *,
    job_id: uuid.UUID,
    applicant_id: uuid.UUID,
    message: str | None = None,
    proposed_price: Decimal | None = None,
) -> Application:
    """Create a new job application."""
    app = Application(
        job_id=job_id,
        applicant_id=applicant_id,
        message=message or "I am interested in this job and available to start.",
        proposed_price=proposed_price,
        status="pending",
    )
    db.add(app)
    await db.flush()
    return app


async def get_by_id(db: AsyncSession, application_id: uuid.UUID) -> Application | None:
    """Find an application by its id."""
    stmt = select(Application).where(Application.id == application_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def get_by_job_and_applicant(
    db: AsyncSession, job_id: uuid.UUID, applicant_id: uuid.UUID
) -> Application | None:
    """Find an existing application for a job by a specific applicant."""
    stmt = select(Application).where(
        Application.job_id == job_id, Application.applicant_id == applicant_id
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def list_by_job(db: AsyncSession, job_id: uuid.UUID) -> list[Application]:
    """List all applications for a job."""
    stmt = (
        select(Application)
        .where(Application.job_id == job_id)
        .order_by(Application.created_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def list_applied_job_ids(db: AsyncSession, applicant_id: uuid.UUID) -> set[uuid.UUID]:
    """Return the set of job IDs this user has already applied to."""
    stmt = select(Application.job_id).where(Application.applicant_id == applicant_id)
    res = await db.execute(stmt)
    return set(res.scalars().all())
