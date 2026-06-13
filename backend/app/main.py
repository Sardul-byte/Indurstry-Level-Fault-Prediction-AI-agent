"""
FastAPI application factory.

Usage:
    from app.main import create_app

    app = create_app()

Running locally:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.responses import JSONResponse

from app.api.middleware import (
    RequestIDMiddleware,
    RequestSizeLimitMiddleware,
    http_exception_handler,
    unhandled_exception_handler,
)
from app.core.config import settings, validate_on_startup
from app.core.database import close_db, init_db
from app.core.errors import make_error_response
from app.core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown lifecycle.

    Startup:
      1. validate_on_startup() — exit(1) if critical env vars are missing.
      2. init_db()             — create all ORM tables if they don't exist.
      3. Qdrant collection     — create ``knowledge_base`` collection if absent.

    Shutdown:
      1. close_db()            — dispose SQLAlchemy engine / connection pool.
    """
    # ── Startup ─────────────────────────────────────────────────────────────
    logger.info("application_startup", env=settings.model_config.get("env_file", ".env"))

    validate_on_startup()

    await init_db()
    logger.info("database_initialised")

    # Qdrant collection bootstrap — best-effort; log but don't crash if
    # Qdrant is unavailable at startup (it may come up later in Docker Compose).
    try:
        from qdrant_client import AsyncQdrantClient
        from qdrant_client.models import Distance, VectorParams

        qdrant = AsyncQdrantClient(url=settings.QDRANT_URL)
        existing = await qdrant.get_collections()
        existing_names = {c.name for c in existing.collections}

        if settings.QDRANT_COLLECTION not in existing_names:
            await qdrant.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE),
            )
            logger.info(
                "qdrant_collection_created",
                collection=settings.QDRANT_COLLECTION,
            )
        else:
            logger.info(
                "qdrant_collection_exists",
                collection=settings.QDRANT_COLLECTION,
            )

        await qdrant.close()

    except Exception as exc:
        logger.warning(
            "qdrant_startup_check_failed",
            reason=str(exc),
            collection=settings.QDRANT_COLLECTION,
        )

    logger.info("application_ready", port=settings.API_PORT)

    yield  # ── Application runs here ──────────────────────────────────────

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("application_shutdown")
    await close_db()
    logger.info("database_connections_closed")


# ---------------------------------------------------------------------------
# Validation error handler
# ---------------------------------------------------------------------------


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Return HTTP 422 with field-level error details for Pydantic validation failures.

    Each error entry in the response body includes:
    - ``loc``  : list of field path segments (e.g. ``["body", "alert_data"]``)
    - ``msg``  : human-readable error description
    - ``type`` : Pydantic error type string

    Requirement 1.2, 1.5, 18.1.
    """
    request_id: str = getattr(request.state, "request_id", str(uuid.uuid4()))

    errors = [
        {
            "loc": list(error["loc"]),
            "msg": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]

    logger.warning(
        "validation_error",
        path=request.url.path,
        error_count=len(errors),
    )

    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": "Request validation failed.",
            "request_id": request_id,
            "errors": errors,
        },
        headers={"X-Request-ID": request_id},
    )


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application.

    Returns a fully wired :class:`~fastapi.FastAPI` instance with:
    - Lifespan handler (startup + shutdown)
    - RequestSizeLimitMiddleware (enforces MAX_PAYLOAD_SIZE_MB → 413)
    - RequestIDMiddleware (UUID4 request_id on every request)
    - Exception handlers for RequestValidationError, HTTPException, Exception
    - /health endpoint
    - All API routers under /api/v1 (guarded with try/except ImportError)
    - Swagger UI at /docs, ReDoc at /redoc
    """
    application = FastAPI(
        title="AI Incident Response Commander",
        description=(
            "Production-grade agentic AI platform that autonomously investigates "
            "software production incidents via a multi-agent LangGraph pipeline."
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── Middleware (added in reverse order — last added = outermost) ─────────
    # Size limit must run *before* request-id binding so the 413 response still
    # carries a request_id header.  Adding RequestIDMiddleware first means it
    # wraps the size-limit middleware, so IDs are always available.
    application.add_middleware(RequestIDMiddleware)
    application.add_middleware(RequestSizeLimitMiddleware)

    # ── Exception handlers ───────────────────────────────────────────────────
    application.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
    application.add_exception_handler(HTTPException, http_exception_handler)  # type: ignore[arg-type]
    application.add_exception_handler(Exception, unhandled_exception_handler)

    # ── Routers ──────────────────────────────────────────────────────────────
    # Routes may not yet exist during early development; guard each import so
    # the application still starts while individual route modules are being built.
    _API_PREFIX = "/api/v1"

    try:
        from app.api.routes.incidents import router as incidents_router

        application.include_router(incidents_router, prefix=_API_PREFIX)
        logger.debug("router_registered", prefix=_API_PREFIX, router="incidents")
    except ImportError:
        logger.debug("router_not_available", router="incidents")

    try:
        from app.api.routes.reports import router as reports_router

        application.include_router(reports_router, prefix=_API_PREFIX)
        logger.debug("router_registered", prefix=_API_PREFIX, router="reports")
    except ImportError:
        logger.debug("router_not_available", router="reports")

    try:
        from app.api.routes.recommendations import router as recommendations_router

        application.include_router(recommendations_router, prefix=_API_PREFIX)
        logger.debug("router_registered", prefix=_API_PREFIX, router="recommendations")
    except ImportError:
        logger.debug("router_not_available", router="recommendations")

    try:
        from app.api.routes.ingest import router as ingest_router

        application.include_router(ingest_router, prefix=_API_PREFIX)
        logger.debug("router_registered", prefix=_API_PREFIX, router="ingest")
    except ImportError:
        logger.debug("router_not_available", router="ingest")

    # ── Built-in endpoints ───────────────────────────────────────────────────

    @application.get(
        "/health",
        summary="Health check",
        tags=["observability"],
        response_description="Service is healthy",
    )
    async def health() -> dict[str, str]:
        """Simple liveness probe.

        Returns HTTP 200 ``{"status": "ok"}`` when the application process is
        running.  Used by Docker health checks and load-balancer probes.

        Requirement 19.2.
        """
        return {"status": "ok"}

    return application


# ---------------------------------------------------------------------------
# Module-level app instance (used by uvicorn and pytest)
# ---------------------------------------------------------------------------

app: FastAPI = create_app()
