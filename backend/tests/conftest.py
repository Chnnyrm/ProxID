"""Test configuration.

The application refuses to start without a signing key and a database URL, so the test
environment supplies both before anything imports ``app``. No test connects to a
database: the suite covers the rules that do not need one, which is where the ported
geo semantics, the x402 rule set, the audit hashing and the spending limits live.
"""

from __future__ import annotations

import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-only-secret-key-that-is-long-enough-32")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/proxid_test"
)
