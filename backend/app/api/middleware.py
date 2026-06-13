"""
ASGI middleware and global exception handlers for the FastAPI application.

Components:
  - RequestIDMiddleware  — generates a UUID4 request_id per request, stores it
                           in request.state, adds X-Request-ID response header,
                           and binds it to the structlog context.
  - request_size_limit_middleware — enforces MAX_PAYLOAD_SIZE_MB; returns 413
                                    when Content-Length exceeds the limit.
  - http_exception_handler        — converts HTTPException → structured ErrorResponse.
  - unhandled_exception_handler   — converts any other exception → HTTP 500,
                                    logging the full traceback internally without
                                    leaking it to the caller.
"""

from __future__ import annotations

import uuid

from fastapi import Request, Response
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.errors import make_error_response
from app.core.logging import bind_request_id, clear_request_context, get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# RequestIDMiddleware
# ---------------------------------------------------------------------------


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Assign a unique UUID4 ``request_id`` to every incoming request.

    For each request this middleware:
    1. Generates a fresh UUID4 (or re-uses ``X-Request-ID`` if already present).
    2. Stores the value in ``request.state.request_id``.
    3. Binds it to the structlog context so every log line emitted within this
       request includes ``request_id`` automatically.
    4. Adds an ``X-Request-ID`` header to the outgoing response.
    5. Clears the structlog context after the response is sent so context
       does not leak into the next request handled by the same async task.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Re-use an existing request ID forwarded by a gateway, or generate one.
        request_id: str = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # Make the ID available to route handlers via request.state.
        request.state.request_id = request_id

        # Bind to structlog context-vars so all log entries include it.
        bind_request_id(request_id)

        try:
            response: Response = await call_next(request)
        finally:
            # Always clean up — even if an exception propagates.
            clear_request_context()

        response.headers["X-Request-ID"] = request_id
        return response


# ---------------------------------------------------------------------------
# Payload-size limit middleware
# ---------------------------------------------------------------------------


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose ``Content-Length`` exceeds ``MAX_PAYLOAD_SIZE_MB``.

    Returns HTTP 413 (Request Entity Too Large) with a structured error body
    before the request body is read.  Requests without a ``Content-Length``
    header are passed through — they will be subject to server-level limits.

    Requirement 1.3: payloads > 50 MB → 413 without starting an Investigation.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        max_bytes = settings.MAX_PAYLOAD_SIZE_MB * 1024 * 1024

        content_length_header = request.headers.get("content-length")
        if content_length_header is not None:
            try:
                content_length = int(content_length_header)
            except ValueError:
                content_length = 0

            if content_length > max_bytes:
                request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
                error = make_error_response(
                    error_code="PAYLOAD_TOO_LARGE",
                    message=(
                        f"Request body exceeds the maximum allowed size of "
                        f"{settings.MAX_PAYLOAD_SIZE_MB} MB."
                    ),
                    request_id=request_id,
                )
                return JSONResponse(
                    status_code=413,
                    content=error.model_dump(),
                    headers={"X-Request-ID": request_id},
                )

        return await call_next(request)


# ---------------------------------------------------------------------------
# Exception handlers (registered on the FastAPI app, not as middleware)
# ---------------------------------------------------------------------------


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Convert ``fastapi.HTTPException`` into a structured :class:`ErrorResponse` JSON body.

    Maps common HTTP status codes to machine-readable ``error_code`` strings.
    Falls back to a generic ``HTTP_{status_code}`` label for unrecognised codes.

    Requirement 18.1: all 4xx/5xx responses include error_code, message, request_id.
    """
    request_id: str = getattr(request.state, "request_id", "unknown")

    _STATUS_TO_CODE: dict[int, str] = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        408: "REQUEST_TIMEOUT",
        409: "CONFLICT",
        410: "GONE",
        413: "PAYLOAD_TOO_LARGE",
        422: "UNPROCESSABLE_ENTITY",
        429: "TOO_MANY_REQUESTS",
        500: "INTERNAL_ERROR",
        501: "NOT_IMPLEMENTED",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
        504: "GATEWAY_TIMEOUT",
    }

    error_code = _STATUS_TO_CODE.get(exc.status_code, f"HTTP_{exc.status_code}")
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)

    error = make_error_response(
        error_code=error_code,
        message=detail,
        request_id=request_id,
    )

    logger.warning(
        "http_exception",
        status_code=exc.status_code,
        error_code=error_code,
        detail=detail,
        path=request.url.path,
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=error.model_dump(),
        headers={"X-Request-ID": request_id},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler for any exception not caught by more specific handlers.

    Security requirements (Requirement 18.4):
    - The response body MUST NOT contain stack traces, internal file paths, or
      raw exception details.
    - The full exception with traceback IS logged internally via structlog so
      engineers can diagnose the failure.
    """
    request_id: str = getattr(request.state, "request_id", "unknown")

    # Log the full exception including traceback for internal diagnostics.
    logger.exception(
        "unhandled_exception",
        exc_type=type(exc).__name__,
        path=request.url.path,
        method=request.method,
    )

    # Return a sanitised response — no stack traces or paths exposed to callers.
    error = make_error_response(
        error_code="INTERNAL_ERROR",
        message="An unexpected error occurred. Please try again later.",
        request_id=request_id,
    )

    return JSONResponse(
        status_code=500,
        content=error.model_dump(),
        headers={"X-Request-ID": request_id},
    )
