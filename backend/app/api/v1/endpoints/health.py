"""Liveness and readiness.

Liveness says the process is up. Readiness says it can serve, which means the
database answers. Neither reveals a version, a dependency name, or configuration,
per the house standard: a health check is an unauthenticated endpoint and must not
become an inventory.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.logging import get_logger
from ...deps import get_db

router = APIRouter()
logger = get_logger("health")


@router.get("")
async def liveness() -> dict[str, str]:
    """The process is running."""
    return {"status": "ok"}


@router.get("/ready")
async def readiness(
    response: Response, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    """The process can serve a request that touches the database."""
    try:
        await db.execute(text("SELECT 1"))
    except Exception as error:  # noqa: BLE001 - readiness reports, it does not fail loudly
        logger.error(
            "readiness check failed",
            extra={"operation": "readiness", "error": type(error).__name__},
        )
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable"}
    return {"status": "ready"}
