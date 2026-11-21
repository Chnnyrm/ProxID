"""Structured logging with pattern-based redaction.

The logger redacts by key name and by value shape, so a secret that reaches a log
call is dropped by the logger itself rather than by every call site remembering
to be careful. JSON lines go to stdout; the correlation ID is on every line.
"""

from __future__ import annotations

import json
import logging
import re
import sys
from contextvars import ContextVar
from typing import Any

#: The correlation ID of the request or job being handled. Set by the
#: correlation middleware at the transport boundary and read everywhere else.
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="-")

_REDACTED = "[redacted]"

# Keys whose value is always a secret, matched case-insensitively.
_SECRET_KEY_PATTERN = re.compile(
    r"(password|passwd|secret|token|api[_-]?key|authorization|private[_-]?key|"
    r"session|cookie|credential|signature)",
    re.IGNORECASE,
)

# Values that look like credentials regardless of the key they arrived under.
_SECRET_VALUE_PATTERNS = (
    # JWT
    re.compile(r"^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$"),
    # Bearer header value
    re.compile(r"^Bearer\s+\S{12,}$", re.IGNORECASE),
    # Groq/OpenAI-style keys
    re.compile(r"^gsk_[A-Za-z0-9]{16,}$"),
    # Brevo keys
    re.compile(r"^xkeysib-[A-Za-z0-9-]{16,}$"),
)

# Built-in log record attributes; anything else in a record's __dict__ is ours.
_RESERVED_RECORD_KEYS = frozenset(
    {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "message", "module",
        "msecs", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "thread", "threadName", "taskName",
    }
)


def redact_value(key: str, value: Any) -> Any:
    """Return a safe rendering of one field.

    A sensitive key becomes ``[redacted]``. A non-sensitive key whose string
    value looks like a credential becomes ``[redacted]`` too. Nested mappings and
    sequences are walked, so a dumped request body cannot leak through a nested
    key.
    """
    if _SECRET_KEY_PATTERN.search(key or ""):
        return _REDACTED
    if isinstance(value, dict):
        return {str(k): redact_value(str(k), v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact_value(key, item) for item in value]
    if isinstance(value, str):
        for pattern in _SECRET_VALUE_PATTERNS:
            if pattern.match(value):
                return _REDACTED
        return value
    return value


class RedactingJsonFormatter(logging.Formatter):
    """Render a log record as one JSON object with secrets removed."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": redact_value("message", record.getMessage()),
            "correlation_id": correlation_id_var.get(),
        }
        for key, value in record.__dict__.items():
            if key in _RESERVED_RECORD_KEYS or key.startswith("_"):
                continue
            payload[key] = redact_value(key, value)
        if record.exc_info:
            # The traceback is internal-only: it goes to the log, never to a client.
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    """Install the JSON handler once, replacing whatever root handler exists."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(RedactingJsonFormatter())
    root = logging.getLogger()
    for existing in list(root.handlers):
        root.removeHandler(existing)
    root.addHandler(handler)
    root.setLevel(level.upper())


def get_logger(name: str) -> logging.Logger:
    """The project logger. Import this instead of ``logging.getLogger``."""
    return logging.getLogger(f"proxid.{name}")
