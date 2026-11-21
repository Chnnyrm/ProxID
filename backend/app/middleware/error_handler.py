"""The one place an error becomes an HTTP response.

An ``ApplicationError`` carries both views already: the internal message names the
operation, entity and layer, and ``external_message`` is the sentence a person
reads. This middleware picks the status from the error type, logs the internal view
with the correlation ID, and returns the external view with the same id as a
labelled reference.

Nothing internal reaches the client: no exception type, no SQL, no path, no stack.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from ..core.errors import ApplicationError
from ..core.logging import correlation_id_var, get_logger

logger = get_logger("errors")


def _envelope(code: str, message: str, reference: str | None) -> dict[str, object]:
    return {"error": {"code": code, "message": message, "reference": reference}}


def _validation_message(errors: list[dict]) -> str:
    """Turn the first validation failure into a sentence naming the field.

    Pydantic's message ("String should have at least 4 characters") is close but
    speaks about a string, not about a field. This names the field and states the
    fix, and collapses the rest into a count so the response stays readable.
    """
    if not errors:
        return "Some of the details you sent could not be accepted. Check the form and try again."
    first = errors[0]
    location = ".".join(str(part) for part in first.get("loc", []) if part not in ("body", "query", "path"))
    field = location or "a field"
    raw = str(first.get("msg") or "").strip()
    lowered = raw.lower()
    if "field required" in lowered:
        detail = f"{field} is needed"
    elif "at least" in lowered or "min_length" in lowered:
        detail = f"{field} is too short"
    elif "at most" in lowered or "max_length" in lowered:
        detail = f"{field} is too long"
    elif "greater than" in lowered:
        detail = f"{field} has to be larger than zero"
    elif "valid email" in lowered:
        detail = f"{field} does not look like an email address"
    elif "extra_forbidden" in lowered or "extra fields not permitted" in lowered:
        detail = f"{field} is not a field this form accepts"
    else:
        detail = f"{field} is not in the right format"
    extra = len(errors) - 1
    if extra == 1:
        suffix = " There is 1 more thing to check."
    elif extra > 1:
        suffix = f" There are {extra} more things to check."
    else:
        suffix = ""
    return f"{detail[0].upper()}{detail[1:]}.{suffix}"


def register_error_handlers(app: FastAPI) -> None:
    """Attach the handlers. Called once from ``main.create_app``."""

    @app.exception_handler(ApplicationError)
    async def handle_application_error(request: Request, error: ApplicationError) -> JSONResponse:
        reference = correlation_id_var.get()
        error.with_correlation_id(reference)
        logger.error(
            "request failed",
            extra={"operation": error.operation, **error.to_log_context(), "path": request.url.path},
        )
        return JSONResponse(
            status_code=error.http_status,
            content=_envelope(error.code, error.external_message, reference),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        reference = correlation_id_var.get()
        logger.info(
            "request rejected at the boundary",
            extra={
                "operation": "validate_request",
                "path": request.url.path,
                "errors": [
                    {"loc": item.get("loc"), "type": item.get("type")} for item in error.errors()
                ],
                "correlation_id": reference,
            },
        )
        return JSONResponse(
            status_code=422,
            content=_envelope("validation_error", _validation_message(list(error.errors())), reference),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(
        request: Request, error: StarletteHTTPException
    ) -> JSONResponse:
        reference = correlation_id_var.get()
        # Frameworks raise these for routing and method problems. The message is
        # already user-safe, but it is rephrased so no status code appears in text.
        friendly = {
            404: "That page does not exist. Check the address, or start from the home page.",
            405: "That action is not available on this address.",
            401: "Sign in to continue.",
            403: "You do not have access to that.",
            429: "Too many requests just now. Wait a moment and try again.",
        }.get(error.status_code, "That request could not be handled. Start from the home page and try again.")
        return JSONResponse(
            status_code=error.status_code,
            content=_envelope("request_error", friendly, reference),
            headers=getattr(error, "headers", None),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
        reference = correlation_id_var.get()
        # The full cause goes to the log, with the traceback, and never to the client.
        logger.exception(
            "unhandled error",
            extra={
                "operation": "handle_request",
                "path": request.url.path,
                "error_type": type(error).__name__,
                "correlation_id": reference,
            },
        )
        return JSONResponse(
            status_code=500,
            content=_envelope(
                "internal_error",
                "We could not finish that. Nothing you entered was lost. Try again in a moment, "
                "and if it keeps happening, contact support with the reference below.",
                reference,
            ),
        )
