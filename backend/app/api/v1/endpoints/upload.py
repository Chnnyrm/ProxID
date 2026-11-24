"""Media upload endpoints."""

from __future__ import annotations

import os
import tempfile

from fastapi import APIRouter, Depends, File, Query, UploadFile

from ....core.container import Container
from ....schemas.base import OutputModel
from ...deps import CurrentUser, get_container, get_current_user

router = APIRouter()


class UploadOut(OutputModel):
    """Result of an asset upload."""

    url: str
    public_id: str


@router.post("", response_model=UploadOut)
@router.post("/", response_model=UploadOut)
async def upload_asset(
    file: UploadFile = File(...),
    purpose: str = Query(default="avatars"),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> UploadOut:
    """Upload one asset to Cloudinary under the scoped purpose folder."""
    suffix = os.path.splitext(file.filename or "upload.png")[1]
    if not suffix:
        suffix = ".png"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        try:
            content = await file.read()
            tmp.write(content)
            tmp.flush()
            tmp_path = tmp.name
        except Exception:
            if os.path.exists(tmp.name):
                os.unlink(tmp.name)
            raise

    try:
        result = await container.cloudinary.upload(tmp_path, purpose=purpose)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    return UploadOut(url=result["secure_url"], public_id=result["public_id"])
