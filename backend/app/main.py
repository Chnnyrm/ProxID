"""Application entry point: build the graph, mount the routes, own the lifecycle.

``create_app`` takes settings so a test can build an app around a test configuration
without touching the environment. The container is built in the lifespan and hung on
``app.state``; nothing at import time opens a connection or reads a secret.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.router import api_router
from .core.config import Settings, settings as default_settings
from .core.container import Container, build_container
from .core.logging import configure_logging, get_logger
from .middleware.correlation import CorrelationMiddleware
from .middleware.error_handler import register_error_handlers
from .middleware.rate_limit import RateLimitMiddleware
from .middleware.security_headers import SecurityHeadersMiddleware

logger = get_logger("main")


def _log_feature_flags(settings: Settings) -> None:
    """One line per flag at startup, so a deployment's behaviour is on the record."""
    for name in (
        "FEATURE_CONCORDIUM_LIVE",
        "FEATURE_X402_PAYMENTS",
        "FEATURE_JUDGE_DEMO",
        "FEATURE_AGENT_TOOLS",
        "FEATURE_EMAIL_DELIVERY",
        "FEATURE_MEDIA_UPLOAD",
    ):
        logger.info(
            "feature flag",
            extra={"operation": "startup", "flag": name, "enabled": getattr(settings, name)},
        )


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application around one configuration."""
    resolved = settings or default_settings
    configure_logging()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        resolved.assert_runtime_configuration()
        container: Container = build_container(resolved)
        app.state.container = container
        _log_feature_flags(resolved)
        if not resolved.concordium_configured:
            logger.warning(
                "Concordium is not configured: verification, x402 and the agent registry "
                "answer not_configured. No network call is attempted.",
                extra={"operation": "startup"},
            )
        try:
            yield
        finally:
            await container.database.dispose()

    app = FastAPI(
        title="ProxID API",
        version="2.0.0",
        description=(
            "Hyper-local services marketplace. Providers carry a Concordium zero-knowledge "
            "proof of personhood, the agent is registered with a CIS-8004 agent card, and "
            "payments settle over x402. The Concordium integration is not configured in this "
            "build: those endpoints answer not_configured and attempt no network call."
        ),
        lifespan=lifespan,
        docs_url="/docs" if resolved.APP_ENV != "production" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if resolved.APP_ENV != "production" else None,
    )

    # Order matters. Correlation is outermost so every log line below it, including
    # the error handler's, carries the same id. Security headers wrap the rate
    # limiter so even a 429 carries them.
    app.add_middleware(RateLimitMiddleware, settings=resolved)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(CorrelationMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-CSRF-Token",
            "X-Request-ID",
            "X-PAYMENT",
            "X-Payment",
            "Payment-Signature",
        ],
        expose_headers=["X-Request-ID", "Payment-Required", "X-Payment-Required"],
        max_age=600,
    )

    register_error_handlers(app)
    app.include_router(api_router, prefix=resolved.API_V1_PREFIX)
    return app


app = create_app()
