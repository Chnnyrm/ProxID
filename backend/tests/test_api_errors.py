"""The transport contract: errors are useful to a person and reveal nothing internal.

These run against the real application object but never reach the database: validation
fails, or the path does not exist, before any query.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.middleware.rate_limit import RateLimitMiddleware

INTERNAL_MARKERS = ("Traceback", "pydantic", "sqlalchemy", "asyncpg", "psycopg", "/home/", ".py")


def app_client() -> TestClient:
    """The real app, built around test settings."""
    settings = Settings(
        APP_ENV="test",
        SECRET_KEY="test-only-secret-key-that-is-long-enough-32",
        CORS_ORIGINS="http://localhost:5173",
    )
    return TestClient(create_app(settings), raise_server_exceptions=False)


def test_a_validation_failure_names_the_field_and_leaks_nothing() -> None:
    """A person is told which field is wrong; the response carries no internals."""
    with app_client() as client:
        response = client.post("/api/v1/auth/login", json={"email": "not-an-email"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert "email" in body["error"]["message"].lower()
    assert body["error"]["reference"]
    rendered = response.text
    for marker in INTERNAL_MARKERS:
        assert marker not in rendered, marker


def test_an_unknown_field_is_rejected_rather_than_ignored() -> None:
    """Mass assignment starts with a field the schema quietly accepted."""
    with app_client() as client:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "a@b.co", "password": "x", "role": "provider"},
        )
    assert response.status_code == 422
    assert "role" in response.json()["error"]["message"].lower()


def test_an_unknown_path_answers_in_the_same_envelope() -> None:
    """One shape for every failure, so a client writes one handler."""
    with app_client() as client:
        response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert set(response.json()["error"]) == {"code", "message", "reference"}


def test_every_response_carries_a_correlation_id_header() -> None:
    """The reference in the body and the header are the same id, or support cannot trace it."""
    with app_client() as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.headers["x-request-id"]
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_the_demo_login_route_is_mounted_whatever_the_flag_says() -> None:
    """The route is always present so client types are stable; the flag decides behaviour.

    Hiding a route behind a flag would silently change the generated API surface between
    deployments, which is worse than a stable path that refuses with a sentence.
    """
    on = Settings(
        APP_ENV="test",
        SECRET_KEY="test-only-secret-key-that-is-long-enough-32",
        FEATURE_JUDGE_DEMO=True,
    )
    off = Settings(
        APP_ENV="test",
        SECRET_KEY="test-only-secret-key-that-is-long-enough-32",
        FEATURE_JUDGE_DEMO=False,
    )
    assert "/api/v1/auth/demo-login" in create_app(on).openapi()["paths"]
    assert "/api/v1/auth/demo-login" in create_app(off).openapi()["paths"]


def test_the_rate_limiter_refuses_the_request_after_the_limit() -> None:
    """A fixed window of two per minute on a stub app, so the third call is refused."""
    settings = Settings(
        APP_ENV="test",
        SECRET_KEY="test-only-secret-key-that-is-long-enough-32",
        RATE_LIMIT_AUTH_PER_MINUTE=2,
        RATE_LIMIT_WRITE_PER_MINUTE=2,
        RATE_LIMIT_DEFAULT_PER_MINUTE=2,
    )
    stub = FastAPI()
    stub.add_middleware(RateLimitMiddleware, settings=settings)

    @stub.post("/api/v1/auth/login")
    async def login() -> dict[str, str]:
        return {"status": "ok"}

    @stub.get("/api/v1/services")
    async def browse() -> dict[str, str]:
        return {"status": "ok"}

    with TestClient(stub) as client:
        assert client.post("/api/v1/auth/login").status_code == 200
        assert client.post("/api/v1/auth/login").status_code == 200
        refused = client.post("/api/v1/auth/login")
        assert refused.status_code == 429
        assert refused.headers["retry-after"]
        # A different class of endpoint has its own bucket, so a login storm does not
        # lock the person out of browsing.
        assert client.get("/api/v1/services").status_code == 200


def test_an_unexpected_error_returns_the_envelope_and_no_traceback() -> None:
    """A broken endpoint must not hand the client a stack trace or a framework name.

    Built as a stub app so the failure is deliberate: the handler is the thing under
    test, not the endpoint.
    """
    from app.middleware.error_handler import register_error_handlers

    stub = FastAPI()
    register_error_handlers(stub)

    @stub.get("/explode")
    async def explode() -> dict[str, str]:
        raise RuntimeError("connection to db-internal-01 refused")

    with TestClient(stub, raise_server_exceptions=False) as client:
        response = client.get("/explode")

    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "internal_error"
    assert body["error"]["reference"]
    for marker in ("db-internal-01", "RuntimeError", "Traceback", "refused"):
        assert marker not in response.text, marker
