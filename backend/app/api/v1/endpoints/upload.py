"""Media upload endpoints."""

from __future__ import annotations

import os
import tempfile

from fastapi import APIRouter, Depends, File, Query, UploadFile

from ....core.container import Container
from ....core.image import build_derivatives, process_image
from ....schemas.base import OutputModel
from ...deps import CurrentUser, get_container, get_current_user

router = APIRouter()


class DerivativeOut(OutputModel):
    """One image derivative with URL and dimensions."""

    url: str
    width: int
    height: int


class UploadOut(OutputModel):
    """Result of an asset upload."""

    url: str
    public_id: str
    format: str
    bytes_before: int
    bytes_after: int
    width: int
    height: int
    derivatives: dict[str, DerivativeOut]


@router.post("", response_model=UploadOut)
@router.post("/", response_model=UploadOut)
async def upload_asset(
    file: UploadFile = File(...),
    purpose: str = Query(default="avatars"),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> UploadOut:
    """Upload one asset to Cloudinary under the scoped purpose folder."""
    content = await file.read()
    processed = process_image(content)

    with tempfile.NamedTemporaryFile(delete=False, suffix=processed.extension) as tmp:
        try:
            tmp.write(processed.content)
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

    raw_eager = result.get("eager") or []
    eager_map = {
        item.get("width"): item.get("secure_url")
        for item in raw_eager
        if isinstance(item, dict) and item.get("width") and item.get("secure_url")
    }

    raw_derivatives = build_derivatives(
        result["secure_url"], processed.width, processed.height, eager_map=eager_map
    )
    derivatives_out = {
        name: DerivativeOut(
            url=d["url"],
            width=d["width"],
            height=d["height"],
        )
        for name, d in raw_derivatives.items()
    }

    return UploadOut(
        url=result["secure_url"],
        public_id=result["public_id"],
        format=processed.format,
        bytes_before=processed.bytes_before,
        bytes_after=processed.bytes_after,
        width=processed.width,
        height=processed.height,
        derivatives=derivatives_out,
    )
