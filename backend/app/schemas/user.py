"""User contracts: sign-up, sign-in, Google, the demo session, and the profile."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field, field_validator

from .base import InputModel, OutputModel, TrimmedText

#: Password bounds. 12 is the house floor; the upper bound keeps bcrypt's 72-byte
#: truncation from silently discarding the end of a long passphrase.
PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_LENGTH = 128


class UserRegister(TrimmedText):
    """Create an account with an email and a password."""

    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    display_name: str = Field(min_length=2, max_length=80)

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        return value.strip().lower()


class UserLogin(InputModel):
    """Sign in with an email and a password."""

    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if "@" not in cleaned:
            raise ValueError("Email does not look like an email address.")
        return cleaned


class GoogleCredential(InputModel):
    """What the Google button hands back: a one-time access token."""

    access_token: str = Field(min_length=16, max_length=4096)


class UserUpdate(TrimmedText):
    """The fields a person may change about themselves.

    Deliberately narrow: verification, role and demo flags are not settable here,
    so a request body can never grant a badge.
    """

    display_name: str | None = Field(default=None, min_length=2, max_length=80)
    username: str | None = Field(default=None, min_length=3, max_length=30, pattern="^[a-z0-9_-]+$")
    bio: str | None = Field(default=None, max_length=1000)
    avatar_url: str | None = Field(default=None, max_length=2048)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    neighbourhood: str | None = Field(default=None, max_length=120)
    onboarded: bool | None = Field(default=None)


class SessionOut(OutputModel):
    """A signed-in session.

    The token is returned in the body for non-browser clients and also set as an
    HttpOnly cookie for the browser; the browser ignores this copy.
    """

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime
    user: "UserOut"


class UserOut(OutputModel):
    """The public shape of a person. Never includes a hash, an email for others,
    or a raw proof."""

    id: uuid.UUID
    display_name: str
    username: str | None = None
    role: str
    avatar_url: str | None = None
    bio: str | None = None
    neighbourhood: str | None = None
    concordium_verified: bool
    cis8004_agent_id: str | None = None
    onboarded: bool = False
    is_demo: bool
    created_at: datetime


class PublicProfileOut(OutputModel):
    """The public shareable profile reachable at /u/:username without auth."""

    id: uuid.UUID
    display_name: str
    username: str
    avatar_url: str | None = None
    bio: str | None = None
    neighbourhood: str | None = None
    concordium_verified: bool = False
    completed_jobs: int = 0
    vouches_count: int = 0
    average_rating: float | None = None
    member_since: datetime
    services: list["ProviderServiceOut"] = Field(default_factory=list)


class MeOut(UserOut):
    """The signed-in person's own profile, including the fields only they see."""

    email: str
    concordium_account_address: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class ProviderOut(UserOut):
    """A provider in a search result, with the facts that decide a hire.

    ``concordium_verified`` is the human proof. ``is_demo`` says whether the row
    came from the judge seed, so nobody mistakes a demonstration for a real
    verified person.
    """

    distance_km: float | None = None
    completed_jobs: int = 0
    average_rating: float | None = None
    rating_count: int = 0
    services: list["ProviderServiceOut"] = Field(default_factory=list)


class ProviderServiceOut(OutputModel):
    """One listing shown inside a provider card."""

    id: uuid.UUID
    title: str
    price: float
    category_name: str | None = None
    image_url: str | None = None


SessionOut.model_rebuild()
ProviderOut.model_rebuild()
PublicProfileOut.model_rebuild()
