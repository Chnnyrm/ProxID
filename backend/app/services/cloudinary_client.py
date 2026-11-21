"""Cloudinary media uploads, behind a guard and a feature flag.

Ported from Gigr's ``services/cloudinary_client.py``. The behaviour kept: one
configured client, an upload that returns Cloudinary's response, and a delete by
public id. What changed: the SDK call runs in a worker thread so a synchronous
HTTPS upload cannot block the event loop, and the call is behind the shared
dependency guard and the ``FEATURE_MEDIA_UPLOAD`` flag.
"""

from __future__ import annotations

import asyncio
import uuid

import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import Error as CloudinaryError

from ..core.config import Settings
from ..core.errors import DependencyUnavailableError, ValidationError
from ..core.logging import get_logger
from ..core.resilience import DependencyGuard

logger = get_logger("cloudinary")

#: The only file extensions accepted for a job photo or an avatar.
ALLOWED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".heic")


class CloudinaryClient:
    """Uploads and deletes media. Inert until the feature is switched on."""

    def __init__(self, settings: Settings, guard: DependencyGuard) -> None:
        self._settings = settings
        self._guard = guard
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

    @property
    def is_configured(self) -> bool:
        """True when the flag is on and all three credentials exist."""
        return bool(
            self._settings.FEATURE_MEDIA_UPLOAD
            and self._settings.CLOUDINARY_CLOUD_NAME
            and self._settings.CLOUDINARY_API_KEY
            and self._settings.CLOUDINARY_API_SECRET
        )

    async def upload(self, file_path: str, *, public_id: str | None = None) -> dict:
        """Upload one file and return Cloudinary's response.

        Raises ``ValidationError`` for a disallowed extension and
        ``DependencyUnavailableError`` when the integration is off or unreachable.

        Worst-case input: a path outside the upload directory is rejected by the
        caller; the extension allowlist is checked here as the second line; a
        Cloudinary outage surfaces as a dependency error with a retry message.
        """
        if not self.is_configured:
            raise DependencyUnavailableError(
                "cloudinary",
                "upload refused: media upload is disabled or unconfigured (layer=http_client)",
                operation="upload_media",
                external_message=(
                    "Photo uploads are turned off on this deployment. You can still describe "
                    "the job in words."
                ),
            )
        lowered = file_path.lower()
        if not any(lowered.endswith(extension) for extension in ALLOWED_EXTENSIONS):
            raise ValidationError(
                f"upload_media refused: path does not end in {ALLOWED_EXTENSIONS} (layer=service)",
                operation="upload_media",
                external_message="Upload a photo as JPG, PNG or WebP.",
            )

        resolved_id = public_id or f"{self._settings.CLOUDINARY_UPLOAD_FOLDER}/{uuid.uuid4().hex}"

        async def call() -> dict:
            # The SDK is synchronous; a thread keeps the event loop responsive.
            return await asyncio.to_thread(
                cloudinary.uploader.upload,
                file_path,
                public_id=resolved_id,
                overwrite=False,
                resource_type="image",
            )

        try:
            return await self._guard.call("cloudinary_upload", call)
        except CloudinaryError as error:
            raise DependencyUnavailableError(
                "cloudinary",
                f"upload_media failed: {type(error).__name__} (layer=http_client)",
                operation="upload_media",
                external_message=(
                    "We could not store that photo. Try again, or post the job without a photo."
                ),
            ) from error

    async def delete(self, public_id: str) -> bool:
        """Delete one asset. Returns False when the integration is off."""
        if not self.is_configured:
            return False

        async def call() -> dict:
            return await asyncio.to_thread(cloudinary.uploader.destroy, public_id, resource_type="image")

        result = await self._guard.call("cloudinary_destroy", call)
        return result.get("result") == "ok"
