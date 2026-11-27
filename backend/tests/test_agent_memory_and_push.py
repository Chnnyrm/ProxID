"""Unit tests for agent memory schemas, location awareness, and push schemas."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.schemas.agent import (
    AgentAction,
    AgentConversationOut,
    AgentRunOut,
    AgentStepOut,
    AgentTurnOut,
)
from app.schemas.notification import (
    NotificationOut,
    PushPublicKeyOut,
    PushStatusOut,
    PushSubscriptionIn,
    TestNotificationIn as NotificationTestIn,
)
from app.services.agent_tools import (
    ToolContext,
    resolve_coordinates,
)


def _make_ctx(user: MagicMock) -> ToolContext:
    return ToolContext(
        db=MagicMock(),
        user=user,
        jobs=MagicMock(),
        listings=MagicMock(),
        messages=MagicMock(),
        payments=MagicMock(),
        users=MagicMock(),
    )


def test_resolve_coordinates_priority_user_stored_coords() -> None:
    """User stored coordinates take priority over everything else without asking."""
    mock_user = MagicMock()
    mock_user.latitude = 6.5095
    mock_user.longitude = 3.3711
    mock_user.neighbourhood = "Ikeja"

    ctx = _make_ctx(mock_user)
    lat, lng = resolve_coordinates(ctx, {})
    assert lat == 6.5095
    assert lng == 3.3711


def test_resolve_coordinates_priority_request_args() -> None:
    """If user has no coords, request args take next priority."""
    mock_user = MagicMock()
    mock_user.latitude = None
    mock_user.longitude = None
    mock_user.neighbourhood = "Ikeja"

    ctx = _make_ctx(mock_user)
    lat, lng = resolve_coordinates(ctx, {"latitude": 6.4531, "longitude": 3.4244})
    assert lat == 6.4531
    assert lng == 3.4244


def test_resolve_coordinates_priority_saved_neighbourhood() -> None:
    """If neither user coords nor args provide coords, saved neighbourhood is looked up."""
    mock_user = MagicMock()
    mock_user.latitude = None
    mock_user.longitude = None
    mock_user.neighbourhood = "yaba"

    ctx = _make_ctx(mock_user)
    lat, lng = resolve_coordinates(ctx, {})
    assert lat == 6.5121
    assert lng == 3.3739


def test_agent_conversation_schemas() -> None:
    """AgentConversationOut and AgentTurnOut correctly validate and serialize history."""
    conv_id = uuid.uuid4()
    turn_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    action = AgentAction(
        id="act-1",
        label="Hire Kosi Adeyemi // NGN 15,000",
        kind="hire",
        target="/services/123",
        payload={"provider_id": "p1"},
    )

    turn = AgentTurnOut(
        id=turn_id,
        conversation_id=conv_id,
        role="assistant",
        content="I found 2 providers near you.",
        steps=[
            AgentStepOut(
                tool="search_providers",
                summary="found 2 providers",
                succeeded=True,
            )
        ],
        actions=[action],
        degraded=False,
        created_at=now,
    )

    conv = AgentConversationOut(
        id=conv_id,
        title="Active conversation",
        turns=[turn],
        created_at=now,
    )

    assert conv.id == conv_id
    assert len(conv.turns) == 1
    assert conv.turns[0].actions[0].label == "Hire Kosi Adeyemi // NGN 15,000"
    assert conv.turns[0].actions[0].kind == "hire"


def test_push_schemas() -> None:
    """Push schemas validate subscription, status, and notification data."""
    sub_in = PushSubscriptionIn(
        endpoint="https://fcm.googleapis.com/fcm/send/test-token",
        keys={"p256dh": "key1", "auth": "key2"},
        user_agent="Chrome 131",
    )
    assert sub_in.endpoint.startswith("https://")
    assert sub_in.keys["p256dh"] == "key1"

    status_out = PushStatusOut(subscribed=True, count=2)
    assert status_out.subscribed is True
    assert status_out.count == 2

    notif_in = NotificationTestIn(
        title="Agent Match Found",
        message="A plumber is ready to start.",
        link="/jobs/456",
        actions=[{"action": "view", "title": "View Job"}],
    )
    assert notif_in.title == "Agent Match Found"
    assert len(notif_in.actions) == 1


def test_parse_and_sanitize_buttons_marker() -> None:
    """The plural form (Buttons: A | B | C) produces three actions and leaves no marker in prose."""
    from app.services.agent_service import parse_and_sanitize_reply

    raw_reply = (
        "Here are some common services I can quickly find for you:\n"
        "(Buttons: Plumber | Electrician | Cleaner)"
    )
    cleaned_reply, actions = parse_and_sanitize_reply(raw_reply)
    assert "(Buttons:" not in cleaned_reply
    assert "Buttons:" not in cleaned_reply
    assert len(actions) == 3
    assert [a["label"] for a in actions] == ["Plumber", "Electrician", "Cleaner"]
    for a in actions:
        assert a["kind"] == "prompt"

