"""Application configuration and the only place a feature flag is declared.

Every setting is read here once at startup and injected from the composition
root (``core/container.py``). No other module calls ``os.getenv``; a machine
check (``backend/arch_check.py``) fails the build if one does.

Feature flags belong here and nowhere else. Each one records the date it was
added and the condition under which it is removed, per the house standard.

The Concordium values are deliberately empty. There is no contract deployed and
no node endpoint chosen yet, so nothing in this file may contain an address or a
host that was not given to us. ``concordium_configured`` is the single predicate
the Concordium services consult; while it is false they return a
``not_configured`` result instead of calling anything.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration, validated on construction."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # -- Application ---------------------------------------------------------
    APP_NAME: str = "ProxID"
    APP_ENV: Literal["development", "test", "production"] = "development"
    API_V1_PREFIX: str = "/api/v1"
    # Origins allowed to call the API. A comma-separated list, never "*".
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # -- Database ------------------------------------------------------------
    # Async SQLAlchemy URL. On Neon or Supabase this is the pooled connection
    # string with the driver rewritten to postgresql+asyncpg.
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/proxid"
    DATABASE_ECHO: bool = False
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 5
    DATABASE_POOL_TIMEOUT_SECONDS: float = 10.0

    # -- Session security ----------------------------------------------------
    # Signing key for session tokens. Must be at least 32 characters.
    SECRET_KEY: str = ""
    SESSION_TOKEN_TTL_HOURS: int = 24 * 7
    SESSION_COOKIE_NAME: str = "proxid_session"
    SESSION_COOKIE_SECURE: bool = False
    SESSION_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"

    # -- Google OAuth --------------------------------------------------------
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_TOKENINFO_URL: str = "https://oauth2.googleapis.com/tokeninfo"

    # -- Groq (LLM for the agent) -------------------------------------------
    # A single key, or several comma-separated keys that are rotated on a 429.
    GROQ_API_KEY: str = ""
    GROQ_API_KEYS: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_TIMEOUT_SECONDS: float = 20.0
    GROQ_MAX_TOKENS: int = 900

    # -- Cloudinary (job photos, avatars) -----------------------------------
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_UPLOAD_FOLDER: str = "proxid"

    # -- Brevo (transactional email) ----------------------------------------
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = ""
    BREVO_SENDER_NAME: str = "ProxID"
    BREVO_API_URL: str = "https://api.brevo.com/v3/smtp/email"

    # -- Map tiles (free OpenStreetMap raster tiles, no paid key) -----------
    # Handed to the browser so the tile URL is not hardcoded in components.
    MAP_TILE_URL: str = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    MAP_TILE_ATTRIBUTION: str = "OpenStreetMap contributors"

    # -- Concordium ----------------------------------------------------------
    # Nothing here is set yet. Leave every value empty until the contracts are
    # deployed and the credentials are issued; an empty value makes the
    # Concordium services return not_configured rather than guess.
    CONCORDIUM_NETWORK: Literal["testnet", "mainnet"] = "testnet"
    # gRPC node endpoint, for example the address of your node. No default.
    CONCORDIUM_NODE_ENDPOINT: str = ""
    # Address of the deployed identity/revocation registry contract. No default.
    CONCORDIUM_IDENTITY_CONTRACT_ADDRESS: str = ""
    # Address of the deployed CIS-8004 agent registry contract. No default.
    CONCORDIUM_AGENT_REGISTRY_ADDRESS: str = ""
    # Account that receives and settles x402 payments. No default.
    CONCORDIUM_X402_MERCHANT_ACCOUNT: str = ""
    # Base URL of the x402 facilitator/verifier once one is chosen. No default.
    CONCORDIUM_X402_FACILITATOR_URL: str = ""
    # Issuer metadata URL used to check a zero-knowledge proof reference. No default.
    CONCORDIUM_ZK_VERIFIER_URL: str = ""
    CONCORDIUM_REQUEST_TIMEOUT_SECONDS: float = 15.0

    # -- Resilience ----------------------------------------------------------
    BREAKER_FAILURE_THRESHOLD: int = 5
    BREAKER_RESET_SECONDS: float = 30.0
    BREAKER_HALF_OPEN_PROBES: int = 1
    OUTBOUND_MAX_ATTEMPTS: int = 3
    OUTBOUND_RETRY_BASE_SECONDS: float = 0.25
    OUTBOUND_BULKHEAD_LIMIT: int = 8

    # -- Rate limits (requests per minute) ----------------------------------
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10
    RATE_LIMIT_WRITE_PER_MINUTE: int = 60
    RATE_LIMIT_DEFAULT_PER_MINUTE: int = 120

    # == Feature flags =======================================================
    # Added 2026-11-21. Removed when the Concordium credentials are issued and
    # the live paths have been exercised against testnet.
    # While false, every Concordium service returns not_configured and no
    # network call is attempted. This gates an integration, not a security
    # control: authorization and validation are always on.
    FEATURE_CONCORDIUM_LIVE: bool = False
    # Added 2026-11-21. Removed when x402 settlement is enabled end to end.
    # While false, the x402 endpoints answer not_configured.
    FEATURE_X402_PAYMENTS: bool = False
    # Added 2026-11-21. Removed once the judge demo is no longer needed.
    # Controls whether POST /auth/demo-login is mounted at all.
    FEATURE_JUDGE_DEMO: bool = True
    # Added 2026-11-21. Removed when the agent is stable in production.
    FEATURE_AGENT_TOOLS: bool = True
    # Added 2026-11-21. Removed when email delivery is exercised in production.
    FEATURE_EMAIL_DELIVERY: bool = False
    # Added 2026-11-21. Removed when media upload is exercised in production.
    FEATURE_MEDIA_UPLOAD: bool = False

    @field_validator("CORS_ORIGINS")
    @classmethod
    def _reject_wildcard_origin(cls, value: str) -> str:
        """A wildcard origin with credentials is a security defect, not a default."""
        if "*" in value:
            raise ValueError(
                "CORS_ORIGINS must list explicit origins; '*' is not allowed "
                "because credentialed requests would be exposed to any site."
            )
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        """The allowlist as a list, with trailing slashes removed."""
        return [origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def groq_keys_list(self) -> list[str]:
        """Every configured Groq key, in the order they are tried.

        ``GROQ_API_KEYS`` (comma-separated) wins over the single ``GROQ_API_KEY``
        so a deployment can rotate keys without a code change.
        """
        if self.GROQ_API_KEYS.strip():
            return [key.strip() for key in self.GROQ_API_KEYS.split(",") if key.strip()]
        if self.GROQ_API_KEY.strip():
            return [self.GROQ_API_KEY.strip()]
        return []

    @property
    def concordium_configured(self) -> bool:
        """True only when every Concordium value needed for a live call is set.

        Checks are on presence, not on validity: nothing here validates an
        address, because no address has been issued yet.
        """
        return bool(
            self.CONCORDIUM_NODE_ENDPOINT
            and self.CONCORDIUM_IDENTITY_CONTRACT_ADDRESS
            and self.CONCORDIUM_X402_MERCHANT_ACCOUNT
        )

    def assert_runtime_configuration(self) -> None:
        """Fail loudly at boot when a value the server cannot run without is absent.

        Imports stay clean without a ``.env``; the server refuses to start. This
        is called from the application lifespan, not at import time, so tooling
        (migrations, the architecture check, tests) can import the app freely.
        """
        missing: list[str] = []
        if len(self.SECRET_KEY) < 32:
            missing.append("SECRET_KEY (at least 32 characters)")
        if not self.DATABASE_URL:
            missing.append("DATABASE_URL")
        if missing:
            raise RuntimeError(
                "ProxID cannot start: set " + ", ".join(missing) + " in backend/.env. "
                "Copy backend/.env.example and fill in the values."
            )


settings = Settings()
