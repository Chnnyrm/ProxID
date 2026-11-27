"""Tests for image processing: magic bytes detection, EXIF orientation and stripping,
canonical re-encoding to WebP/PNG, derivatives generation, and caps.
Pure ASCII only.
"""

from __future__ import annotations

import io
import pytest
from PIL import Image

import pillow_heif
pillow_heif.register_heif_opener()

from app.core.errors import ValidationError
from app.core.image import (
    MAX_UPLOAD_BYTES,
    build_derivatives,
    detect_magic_format,
    process_image,
)


def _make_jpeg_with_exif_orientation() -> bytes:
    img = Image.new("RGB", (200, 100), color=(180, 40, 40))
    exif = img.getexif()
    exif[0x0112] = 6  # Rotated 90 CW in EXIF
    exif[0x010E] = "Private location and owner details"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def _make_heic() -> bytes:
    img = Image.new("RGB", (160, 120), color=(50, 120, 200))
    heif = pillow_heif.from_pillow(img)
    buf = io.BytesIO()
    heif.save(buf, quality=85)
    return buf.getvalue()


def _make_transparent_png() -> bytes:
    img = Image.new("RGBA", (150, 150), color=(0, 0, 0, 0))
    img.putpixel((50, 50), (255, 100, 50, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_gif() -> bytes:
    img = Image.new("RGB", (80, 80), color=(40, 180, 90))
    buf = io.BytesIO()
    img.save(buf, format="GIF")
    return buf.getvalue()


def test_magic_bytes_detection() -> None:
    assert detect_magic_format(_make_jpeg_with_exif_orientation()) == "JPEG"
    assert detect_magic_format(_make_heic()) == "HEIC"
    assert detect_magic_format(_make_transparent_png()) == "PNG"
    assert detect_magic_format(_make_gif()) == "GIF"
    assert detect_magic_format(b"corrupted or plain text") == "unknown"


def test_process_heic_iphone_photo() -> None:
    raw_heic = _make_heic()
    processed = process_image(raw_heic)
    assert processed.format == "WEBP"
    assert processed.extension == ".webp"
    assert processed.detected_input_format == "HEIC"
    assert processed.width == 160
    assert processed.height == 120
    assert not processed.has_transparency
    # Verify it can be opened as clean WebP
    read_img = Image.open(io.BytesIO(processed.content))
    assert read_img.format == "WEBP"
    assert list(read_img.getexif().keys()) == []


def test_process_transparent_png() -> None:
    raw_png = _make_transparent_png()
    processed = process_image(raw_png)
    assert processed.format == "PNG"
    assert processed.extension == ".png"
    assert processed.has_transparency
    read_img = Image.open(io.BytesIO(processed.content))
    assert read_img.format == "PNG"
    assert list(read_img.getexif().keys()) == []


def test_process_gif_renamed_to_png() -> None:
    raw_gif = _make_gif()
    processed = process_image(raw_gif)
    # GIF without transparency re-encodes to canonical WebP
    assert processed.format == "WEBP"
    assert processed.detected_input_format == "GIF"
    read_img = Image.open(io.BytesIO(processed.content))
    assert read_img.format == "WEBP"


def test_exif_orientation_transposed_and_metadata_stripped() -> None:
    raw_jpeg = _make_jpeg_with_exif_orientation()
    processed = process_image(raw_jpeg)
    # Original was (200, 100) with orientation 6 -> transposed must be (100, 200)
    assert processed.width == 100
    assert processed.height == 200
    assert processed.format == "WEBP"
    read_img = Image.open(io.BytesIO(processed.content))
    assert list(read_img.getexif().keys()) == []


def test_derivatives_produced_with_widths() -> None:
    base_url = "https://res.cloudinary.com/dxssh54wy/image/upload/v1795532077/proxid/listings/abc123.webp"
    derivatives = build_derivatives(base_url, width=1600, height=900)
    assert "thumb" in derivatives
    assert "card" in derivatives
    assert "hero" in derivatives
    assert derivatives["thumb"]["width"] == 320
    assert derivatives["card"]["width"] == 800
    assert derivatives["hero"]["width"] == 1600
    assert "c_limit,w_320" in derivatives["thumb"]["url"]
    assert "c_limit,w_800" in derivatives["card"]["url"]
    assert "c_limit,w_1600" in derivatives["hero"]["url"]


def test_cap_at_25mb_rejected_with_exact_limit() -> None:
    fake_huge_data = b"X" * (25 * 1024 * 1024 + 10)
    with pytest.raises(ValidationError) as exc_info:
        process_image(fake_huge_data)
    assert "25 MB" in (exc_info.value.external_message or exc_info.value.message)


def test_undecodable_file_names_format_without_vague_check_format() -> None:
    corrupted_data = b"\xff\xd8\xff\xe0\x00\x10JFIFcorrupted_garbage_bytes_here"
    with pytest.raises(ValidationError) as exc_info:
        process_image(corrupted_data)
    # Must name the format and never say generic 'check format'
    msg = exc_info.value.external_message or exc_info.value.message
    assert "JPEG" in msg
    assert "check format" not in msg.lower()
