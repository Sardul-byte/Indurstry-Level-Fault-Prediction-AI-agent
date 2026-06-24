"""
Unit tests for configuration validation, logging, and middleware components.
"""

from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core.config import validate_on_startup, settings
from app.api.middleware import RequestIDMiddleware, RequestSizeLimitMiddleware


def test_validate_on_startup_success():
    """Verify validate_on_startup succeeds if required configs are set."""
    with patch("app.core.config.settings") as mock_settings:
        mock_settings.QDRANT_URL = "http://localhost:6333"
        mock_settings.DATABASE_URL = "sqlite+aiosqlite:///./dev.db"
        # Should not raise or sys.exit
        validate_on_startup()


def test_validate_on_startup_missing_sys_exit():
    """Verify validate_on_startup calls sys.exit(1) on missing required variables."""
    with patch("app.core.config.settings") as mock_settings, patch("sys.exit") as mock_exit:
        mock_settings.QDRANT_URL = ""
        mock_settings.DATABASE_URL = "sqlite+aiosqlite:///./dev.db"
        validate_on_startup()
        mock_exit.assert_called_once_with(1)


def test_request_id_middleware_injects_uuid():
    """Verify RequestIDMiddleware injects a unique X-Request-ID header and state context."""
    app = FastAPI()
    app.add_middleware(RequestIDMiddleware)

    @app.get("/test")
    def read_test(request: Request):
        return {"request_id": request.state.request_id}

    client = TestClient(app)
    response = client.get("/test")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
    assert response.json()["request_id"] == response.headers["X-Request-ID"]


def test_request_size_limit_middleware():
    """Verify RequestSizeLimitMiddleware rejects oversized payloads with HTTP 413."""
    app = FastAPI()
    app.add_middleware(RequestSizeLimitMiddleware)

    @app.post("/test")
    def post_test():
        return {"status": "ok"}

    # Mock setting limit to 1 MB for testing
    with patch("app.core.config.settings.MAX_PAYLOAD_SIZE_MB", 1):
        client = TestClient(app)
        # Content length > 1MB (1,500,000 bytes)
        headers = {"content-length": "1500000"}
        response = client.post("/test", content=b"a" * 1500000, headers=headers)
        assert response.status_code == 413
        assert response.json()["error_code"] == "PAYLOAD_TOO_LARGE"


def test_global_exception_handler_sanitizes_errors():
    """Verify unhandled exception handler returns 500 with no tracebacks in body."""
    from app.main import create_app
    app = create_app()

    @app.get("/bug")
    def trigger_bug():
        raise ValueError("Critical DB connection password leak: mypassword")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/bug")
    assert response.status_code == 500
    data = response.json()
    assert data["error_code"] == "INTERNAL_ERROR"
    assert "leak" not in data["message"]
    assert "mypassword" not in data["message"]
    assert data["message"] == "An unexpected error occurred. Please try again later."
