"""
Structured error response helpers for the API layer.

Usage:
    from app.core.errors import ErrorResponse, make_error_response

    response = make_error_response(
        error_code="NOT_FOUND",
        message="Investigation not found",
        request_id=request.state.request_id,
    )
"""

from __future__ import annotations

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Structured JSON error body returned for all 4xx and 5xx responses.

    Fields:
        error_code: Machine-readable string identifying the error type
                    (e.g. ``"VALIDATION_ERROR"``, ``"NOT_FOUND"``, ``"INTERNAL_ERROR"``).
        message:    Human-readable description of what went wrong.
        request_id: The ``X-Request-ID`` value for this request, enabling
                    correlation between API responses and internal logs.
    """

    error_code: str
    message: str
    request_id: str


def make_error_response(
    error_code: str,
    message: str,
    request_id: str,
) -> ErrorResponse:
    """Convenience factory that constructs an :class:`ErrorResponse`.

    Args:
        error_code: Machine-readable error identifier.
        message:    Human-readable error description.
        request_id: Request correlation ID.

    Returns:
        A populated :class:`ErrorResponse` instance.
    """
    return ErrorResponse(
        error_code=error_code,
        message=message,
        request_id=request_id,
    )
