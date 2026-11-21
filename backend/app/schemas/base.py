"""Shared wire-format building blocks.

Two base models make the security defaults visible: input models forbid unknown
fields, so a client cannot smuggle a column through mass assignment; output
models read from entities, so a service can hand one back without a manual copy.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

#: A non-empty, trimmed string with an explicit upper bound.
ShortText = Annotated[str, Field(min_length=1, max_length=200)]
LongText = Annotated[str, Field(min_length=1, max_length=4000)]

#: An amount of money. Positive, bounded, and never a float in the database.
Money = Annotated[float, Field(gt=0, le=100_000_000)]


class InputModel(BaseModel):
    """A request body: unknown fields are rejected, strings are trimmed."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OutputModel(BaseModel):
    """A response body built from an entity."""

    model_config = ConfigDict(from_attributes=True)


class MessageOnly(OutputModel):
    """A response that is one sentence for a person, and nothing else."""

    message: str


class ErrorBody(OutputModel):
    """The external view of a failure.

    ``reference`` is the labelled correlation ID. It is never the primary
    message; it exists so a person can quote it to support and an engineer can
    find the matching log line.
    """

    code: str
    message: str
    reference: str | None = None


class ErrorEnvelope(OutputModel):
    """Every non-2xx response from this API has exactly this shape."""

    error: ErrorBody


def strip_control_characters(value: str) -> str:
    """Remove characters that can corrupt a display or a log line.

    Bidirectional overrides and C0/C1 controls are dropped; ordinary Unicode,
    including apostrophes, accents and non-Latin scripts, is kept. Emoji in user
    data is valid input, so it is not stripped.
    """
    return "".join(
        character
        for character in value
        if not (ord(character) < 32 or 0x7F <= ord(character) <= 0x9F or ord(character) in (0x202A, 0x202B, 0x202D, 0x202E, 0x2066, 0x2067, 0x2068, 0x2069))
    )


class TrimmedText(InputModel):
    """Mix-in for models whose text fields must not carry control characters."""

    @field_validator("*", mode="after")
    @classmethod
    def _clean_text(cls, value: object) -> object:
        if isinstance(value, str):
            return strip_control_characters(value).strip()
        return value
