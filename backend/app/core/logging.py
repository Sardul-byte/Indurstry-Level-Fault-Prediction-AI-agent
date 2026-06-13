"""
Structured logging configuration using structlog.

Usage:
    from app.core.logging import get_logger, bind_request_id, clear_request_context

    logger = get_logger(__name__)
    bind_request_id("abc-123")
    logger.info("event_name", key="value")
    clear_request_context()
"""

from __future__ import annotations

import logging
import os
import sys

import structlog
from structlog.contextvars import bind_contextvars, clear_contextvars

# ---------------------------------------------------------------------------
# Detect environment
# ---------------------------------------------------------------------------

_ENV = os.getenv("APP_ENV", "development").lower()
_IS_PRODUCTION = _ENV in {"production", "prod"}
_LOG_LEVEL_NAME = os.getenv("LOG_LEVEL", "INFO").upper()
_LOG_LEVEL = getattr(logging, _LOG_LEVEL_NAME, logging.INFO)


def _configure_structlog() -> None:
    """Configure structlog with the appropriate renderer for the environment."""

    shared_processors: list[structlog.types.Processor] = [
        # Merge any context variables (e.g. request_id) into every log entry.
        structlog.contextvars.merge_contextvars,
        # Add the string log level (INFO, WARNING, …) to every entry.
        structlog.processors.add_log_level,
        # ISO-8601 timestamp.
        structlog.processors.TimeStamper(fmt="iso"),
        # Render stack_info if present.
        structlog.processors.StackInfoRenderer(),
    ]

    if _IS_PRODUCTION:
        # In production: pure JSON output — parseable by log aggregators.
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        # In development: human-friendly coloured console output.
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(_LOG_LEVEL),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    # Also configure the standard-library root logger so that third-party libs
    # using `logging.getLogger(...)` respect the same level.
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=_LOG_LEVEL,
    )


# Run configuration at import time so the very first call to get_logger works.
_configure_structlog()


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def get_logger(name: str = __name__) -> structlog.BoundLogger:
    """Return a structlog bound logger with the ``name`` field pre-bound."""
    return structlog.get_logger(name)


def bind_request_id(request_id: str) -> None:
    """Bind *request_id* into the current async-task / thread context.

    Every log entry emitted after this call (within the same context) will
    automatically include ``request_id``.
    """
    bind_contextvars(request_id=request_id)


def clear_request_context() -> None:
    """Remove all context variables bound via :func:`bind_request_id` (or any
    other ``bind_contextvars`` call) from the current context."""
    clear_contextvars()
