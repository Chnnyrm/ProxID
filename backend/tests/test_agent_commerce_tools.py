"""Tests for the expanded agent commerce tools.

Verifies create_service_listing, update_service_listing, create_category,
post_job, apply_to_job, hire_provider, and request_identity_verification.
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock
import uuid

from app.services.agent_tools import execute_tool, ToolContext, tool_names


@pytest.mark.asyncio
async def test_all_expected_commerce_tools_are_registered():
    names = tool_names()
    expected = [
        "create_service_listing",
        "update_service_listing",
        "create_category",
        "post_job",
        "send_message",
        "apply_to_job",
        "hire_provider",
        "request_identity_verification",
    ]
    for exp in expected:
        assert exp in names, f"Expected {exp} to be registered in agent tools"


@pytest.mark.asyncio
async def test_create_category_tool_guard_whitespace():
    from app.services.agent_tools import _tool_create_category
    context = MagicMock()
    result = await _tool_create_category(context, {"name": "   "})
    assert result["ok"] is False
    assert "Category name cannot be empty" in result["error"]


@pytest.mark.asyncio
async def test_request_identity_verification_not_configured_when_no_service():
    from app.services.agent_tools import _tool_request_identity_verification
    context = MagicMock()
    context.verification = None
    result = await _tool_request_identity_verification(context, {"purpose": "personhood"})
    assert result["ok"] is False
    assert result["status"] == "not_configured"
