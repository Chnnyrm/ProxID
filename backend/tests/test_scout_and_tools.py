"""Unit tests for create_service_listing tool and the vagueness scout."""

from __future__ import annotations

import pytest

from app.schemas.agent import AgentRunOut, AgentStepOut
from app.services.agent_tools import (
    _TOOL_TABLE,
    summarise_step,
    tool_names,
    tool_specs,
)


def test_create_service_listing_tool_registered() -> None:
    """The tools layer exposes create_service_listing with expected schema."""
    names = tool_names()
    assert "create_service_listing" in names
    spec = _TOOL_TABLE["create_service_listing"]
    assert spec["read_only"] is False
    assert "title" in spec["parameters"]["required"]
    assert "price" in spec["parameters"]["required"]
    assert "radius_km" in spec["parameters"]["properties"]


def test_create_service_listing_summarise_step() -> None:
    """summarise_step produces human-readable activity line for create_service_listing."""
    ok_res = {"ok": True, "service": {"title": "Plumbing Leak Fix"}}
    assert summarise_step("create_service_listing", ok_res) == 'published "Plumbing Leak Fix"'

    err_res = {"ok": False, "error": "A service listing needs a price above zero."}
    assert (
        summarise_step("create_service_listing", err_res)
        == "create_service_listing could not run: A service listing needs a price above zero."
    )


def test_agent_step_out_carries_arguments_and_result() -> None:
    """AgentStepOut carries tool arguments and result between speech and outcome."""
    step = AgentStepOut(
        tool="search_providers",
        summary="scouted 2 provider(s) for massage & pain relief",
        succeeded=True,
        arguments={"query": "massage", "latitude": 6.5095, "longitude": 3.3711},
        result={"ok": True, "count": 2},
    )
    assert step.tool == "search_providers"
    assert step.arguments == {"query": "massage", "latitude": 6.5095, "longitude": 3.3711}
    assert step.result == {"ok": True, "count": 2}

    run_out = AgentRunOut(
        reply="I found 2 relief services near you. Which one would you like to hire?",
        steps=[step],
        used_tools=["search_providers"],
    )
    assert len(run_out.steps) == 1
    assert run_out.steps[0].arguments["query"] == "massage"
