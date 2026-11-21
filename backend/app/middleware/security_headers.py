"""Security headers on every response.

Set in one middleware rather than per route, so a new endpoint cannot forget them.
The content security policy is written for this application: no inline script, no
third-party script, tiles and images from OpenStreetMap and Cloudinary only.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

#: Origins this API's documents may load from. The API itself returns JSON, so the
#: policy is deliberately the tightest possible: nothing may be loaded at all.
API_CONTENT_SECURITY_POLICY = (
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach the headers the house standard requires to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("Content-Security-Policy", API_CONTENT_SECURITY_POLICY)
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "no-referrer")
        headers.setdefault("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
        headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        # HSTS is only meaningful over TLS, and only correct over TLS: sending it on
        # a plain-http development server would pin localhost to https in the browser.
        if request.url.scheme == "https":
            headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response
