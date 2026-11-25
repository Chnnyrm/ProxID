"""Notification and Web Push schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from .base import OutputModel, TrimmedText


class PushSubscriptionIn(TrimmedText):
    """Browser PushManager subscription registration."""

    endpoint: str = Field(min_length=10, max_length=2048)
    keys: dict[str, str] = Field(..., description="p256dh and auth keys")
    user_agent: str | None = Field(default=None, max_length=500)


class PushStatusOut(OutputModel):
    """Push subscription status for the current user."""

    subscribed: bool
    count: int


class PushPublicKeyOut(OutputModel):
    """Server VAPID public key."""

    public_key: str


class NotificationActionOut(OutputModel):
    """Action button on an actionable notification."""

    action: str
    title: str


class NotificationOut(OutputModel):
    """An actionable notification row."""

    id: uuid.UUID
    title: str
    message: str
    link: str | None = None
    type: str = "system"
    tag: str | None = None
    actions: list[NotificationActionOut] | None = None
    is_read: bool = False
    push_sent: bool = False
    created_at: datetime


class TestNotificationIn(TrimmedText):
    """Trigger a test notification, verifying push delivery."""

    title: str = Field(default="ProxID Notification", max_length=255)
    message: str = Field(default="This is an actionable notification from proxidAI.", max_length=1000)
    type: str = Field(default="system", max_length=32)
    link: str | None = None
    actions: list[dict[str, str]] | None = None
