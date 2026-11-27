"""Tests for multi-image listings and jobs.
Pure ASCII.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest

from datetime import datetime, timezone

from app.models.job import Job
from app.models.service import ServiceListing
from app.schemas.job import JobCreate
from app.schemas.service import ServiceCreate
from app.services.job_service import to_job_out
from app.services.service_service import to_service_out


def test_service_schema_multi_image_sync():
    """Verify image_url and image_urls sync both ways in ServiceCreate."""
    payload1 = ServiceCreate(
        title="Test Electrician Service",
        price=12000,
        latitude=6.5244,
        longitude=3.3792,
        image_url="https://example.com/cover.png",
    )
    assert payload1.image_urls == ["https://example.com/cover.png"]

    payload2 = ServiceCreate(
        title="Test Electrician Service 2",
        price=15000,
        latitude=6.5244,
        longitude=3.3792,
        image_urls=["https://example.com/one.png", "https://example.com/two.png"],
    )
    assert payload2.image_url == "https://example.com/one.png"


def test_job_schema_multi_image_sync():
    """Verify image_url and image_urls sync both ways in JobCreate."""
    payload1 = JobCreate(
        title="Urgent Pipe Leak",
        description="Fix the bathroom faucet leak under sink",
        price=10000,
        image_url="https://example.com/pipe.png",
    )
    assert payload1.image_urls == ["https://example.com/pipe.png"]

    payload2 = JobCreate(
        title="Fix Roof Tiles",
        description="Replace damaged slate tiles before rains",
        price=25000,
        image_urls=["https://example.com/roof1.png", "https://example.com/roof2.png"],
    )
    assert payload2.image_url == "https://example.com/roof1.png"


def test_to_service_out_multi_image_resolution():
    """Verify to_service_out populates image_urls array properly."""
    now = datetime.now(timezone.utc)
    listing = ServiceListing(
        id=uuid.uuid4(),
        provider_id=uuid.uuid4(),
        title="Plumbing Repair",
        description="Fix all pipes",
        price=Decimal("15000"),
        radius_km=Decimal("5"),
        currency="NGN",
        image_url="https://example.com/main.jpg",
        image_urls=["https://example.com/main.jpg", "https://example.com/detail.jpg"],
        is_active=True,
        is_demo=False,
        created_at=now,
    )
    out = to_service_out(listing)
    assert out.image_url == "https://example.com/main.jpg"
    assert out.image_urls == ["https://example.com/main.jpg", "https://example.com/detail.jpg"]

    # Legacy row with only image_url
    listing_legacy = ServiceListing(
        id=uuid.uuid4(),
        provider_id=uuid.uuid4(),
        title="Plumbing Legacy",
        description="Fix all pipes",
        price=Decimal("15000"),
        radius_km=Decimal("5"),
        currency="NGN",
        image_url="https://example.com/legacy.jpg",
        image_urls=[],
        is_active=True,
        is_demo=False,
        created_at=now,
    )
    out_legacy = to_service_out(listing_legacy)
    assert out_legacy.image_url == "https://example.com/legacy.jpg"
    assert out_legacy.image_urls == ["https://example.com/legacy.jpg"]


def test_to_job_out_multi_image_resolution():
    """Verify to_job_out populates image_urls array properly."""
    now = datetime.now(timezone.utc)
    job = Job(
        id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        title="Electrical Wiring",
        description="Fix tripped breaker box",
        price=Decimal("20000"),
        currency="NGN",
        status="open",
        image_url="https://example.com/box1.jpg",
        image_urls=["https://example.com/box1.jpg", "https://example.com/box2.jpg"],
        is_demo=False,
        created_at=now,
        updated_at=now,
    )
    out = to_job_out(job)
    assert out.image_url == "https://example.com/box1.jpg"
    assert out.image_urls == ["https://example.com/box1.jpg", "https://example.com/box2.jpg"]

    # Legacy row with only image_url
    job_legacy = Job(
        id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        title="Electrical Legacy",
        description="Fix tripped breaker box",
        price=Decimal("20000"),
        currency="NGN",
        status="open",
        image_url="https://example.com/legacy_box.jpg",
        image_urls=[],
        is_demo=False,
        created_at=now,
        updated_at=now,
    )
    out_legacy = to_job_out(job_legacy)
    assert out_legacy.image_url == "https://example.com/legacy_box.jpg"
    assert out_legacy.image_urls == ["https://example.com/legacy_box.jpg"]
