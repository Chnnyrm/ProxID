"""Image processing: magic bytes detection, EXIF orientation and stripping,
canonical re-encoding to WebP/PNG, and derivative generation.
Pure ASCII only.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Any

from PIL import Image, ImageOps

# Register pillow_heif for HEIC/HEIF decoding
try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pass

from .errors import ValidationError

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


@dataclass(frozen=True)
class ProcessedImage:
    """The canonical result of decoding, orienting, stripping EXIF, and re-encoding."""

    content: bytes
    format: str  # "WEBP" or "PNG"
    extension: str  # ".webp" or ".png"
    content_type: str  # "image/webp" or "image/png"
    width: int
    height: int
    bytes_before: int
    bytes_after: int
    has_transparency: bool
    detected_input_format: str


def detect_magic_format(data: bytes) -> str:
    """Detect image format by initial magic bytes rather than extension or MIME header."""
    if len(data) < 12:
        return "unknown"

    # JPEG: starts with FF D8 FF
    if data.startswith(b"\xff\xd8\xff"):
        return "JPEG"

    # PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"

    # GIF: starts with GIF87a or GIF89a
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "GIF"

    # WebP: RIFF....WEBP
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "WEBP"

    # HEIC / HEIF / AVIF: ISOBMFF ftyp box at offset 4
    if data[4:8] == b"ftyp":
        brand = data[8:12].lower()
        if brand in (b"heic", b"heix", b"hevc", b"heim", b"heis", b"mif1", b"msf1"):
            return "HEIC"
        if brand in (b"avif", b"avis"):
            return "AVIF"
        return "HEIF"

    # BMP: starts with BM
    if data.startswith(b"BM"):
        return "BMP"

    # TIFF: starts with II*\x00 or MM\x00*
    if data.startswith(b"II*\x00") or data.startswith(b"MM\x00*"):
        return "TIFF"

    # SVG check: text xml / svg
    prefix = data[:100].lstrip()
    if prefix.startswith(b"<svg") or (prefix.startswith(b"<?xml") and b"<svg" in prefix):
        return "SVG"

    return "unknown"


def _check_transparency(img: Image.Image) -> bool:
    """Return True if image has transparent pixels or alpha palette."""
    if img.mode in ("RGBA", "LA"):
        alpha = img.getchannel("A")
        min_alpha, _ = alpha.getextrema()
        return min_alpha < 255
    if img.mode == "P" and "transparency" in img.info:
        return True
    return False


def process_image(data: bytes, *, max_bytes: int = MAX_UPLOAD_BYTES) -> ProcessedImage:
    """Validate, decode, rotate per EXIF, strip metadata, and re-encode to canonical format.

    - Photographs (opaque) -> WebP quality 82
    - Images with transparency -> PNG
    - Strips all EXIF (including GPS)
    - Capped at 25MB
    """
    bytes_before = len(data)
    if bytes_before > max_bytes:
        raise ValidationError(
            "file_too_large",
            operation="upload_asset",
            external_message=f"File exceeds size limit. Maximum allowed size is {max_bytes // (1024 * 1024)} MB.",
        )

    detected_format = detect_magic_format(data)

    try:
        raw_img = Image.open(io.BytesIO(data))
        raw_img.load()
    except Exception as err:
        fmt_label = detected_format if detected_format != "unknown" else "unrecognised"
        raise ValidationError(
            f"image_decode_failed: {type(err).__name__}",
            operation="upload_asset",
            external_message=(
                f"Could not decode image (detected format: {fmt_label}). "
                "The file is invalid, corrupted, or not an image."
            ),
        ) from err

    # Apply EXIF rotation so photos from iOS / Android are oriented upright
    try:
        transposed = ImageOps.exif_transpose(raw_img)
    except Exception:
        transposed = raw_img

    width, height = transposed.size
    has_trans = _check_transparency(transposed)

    out_buf = io.BytesIO()
    if has_trans:
        canonical_format = "PNG"
        extension = ".png"
        content_type = "image/png"
        if transposed.mode not in ("RGBA", "LA"):
            export_img = transposed.convert("RGBA")
        else:
            export_img = transposed
        # Save as PNG without passing exif kwarg -> EXIF completely stripped
        export_img.save(out_buf, format="PNG", optimize=True)
    else:
        canonical_format = "WEBP"
        extension = ".webp"
        content_type = "image/webp"
        if transposed.mode != "RGB":
            export_img = transposed.convert("RGB")
        else:
            export_img = transposed
        # Save as WebP at quality 82 without passing exif kwarg -> EXIF stripped
        export_img.save(out_buf, format="WEBP", quality=82, method=4)

    canonical_bytes = out_buf.getvalue()
    bytes_after = len(canonical_bytes)

    return ProcessedImage(
        content=canonical_bytes,
        format=canonical_format,
        extension=extension,
        content_type=content_type,
        width=width,
        height=height,
        bytes_before=bytes_before,
        bytes_after=bytes_after,
        has_transparency=has_trans,
        detected_input_format=detected_format,
    )


def build_derivatives(base_url: str, width: int, height: int) -> dict[str, dict[str, Any]]:
    """Build the fixed set of derivatives: thumb 320px, card 800px, hero 1600px."""
    aspect = height / width if width > 0 else 1.0

    specs = {
        "thumb": 320,
        "card": 800,
        "hero": 1600,
    }

    result: dict[str, dict[str, Any]] = {}
    for name, target_w in specs.items():
        scaled_h = max(1, round(target_w * aspect))
        if "/image/upload/" in base_url:
            deriv_url = base_url.replace(
                "/image/upload/", f"/image/upload/c_limit,w_{target_w}/", 1
            )
        else:
            sep = "&" if "?" in base_url else "?"
            deriv_url = f"{base_url}{sep}w={target_w}"

        result[name] = {
            "url": deriv_url,
            "width": target_w,
            "height": scaled_h,
        }

    return result
