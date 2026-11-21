"""Job room message routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....schemas.message import MessageCreate, MessageOut
from ...deps import CurrentUser, get_container, get_current_user, get_db

router = APIRouter()


@router.get("/job/{job_id}", response_model=list[MessageOut])
async def list_messages(
    job_id: uuid.UUID,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[MessageOut]:
    """The thread in one job room the caller takes part in."""
    return await container.messages.list_messages(
        db, current_user, job_id, limit=limit, offset=offset
    )


@router.post("/job/{job_id}", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def post_message(
    job_id: uuid.UUID,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> MessageOut:
    """Post into a job room. Sending is audited, because it reaches another person."""
    return await container.messages.post_message(db, current_user, job_id, payload.body)
