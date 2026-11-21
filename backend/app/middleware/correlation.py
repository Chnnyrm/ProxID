"""Correlation IDs: one id per request, on every log line and every error.

Generated at the transport boundary, attached to a context variable the logger
reads, and returned in a response header so a client can quote it. This is the only
bridge between what a user sees and what an engineer greps.
"""

from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..core.logging import correlation_id_var

#: The response header carrying the reference. Documented in the README.
CORRELATION_HEADER = "X-Request-ID"


class CorrelationMiddleware(BaseHTTPMiddleware):
    """Assign every request an id, echoing an inbound one only when it is well formed."""

    async def dispatch(self, request: Request, call_next) -> Response:
        inbound = request.headers.get(CORRELATION_HEADER, "")
        # Only accept an inbound id that looks like one. A caller-supplied free-form
        # string would otherwise reach log lines and error responses verbatim.
        if inbound and len(inbound) <= 64 and all(character.isalnum() or character in "-_" for character in inbound):
            correlation_id = inbound
        else:
            correlation_id = uuid.uuid4().hex

        token = correlation_id_var.set(correlation_id)
        request.state.correlation_id = correlation_id
        try:
            response = await call_next(request)
        finally:
            correlation_id_var.reset(token)
        response.headers[CORRELATION_HEADER] = correlation_id
        return response


def current_correlation_id(request: Request) -> str:
    """The id for this request, from state where the middleware put it."""
    return getattr(request.state, "correlation_id", "-")
