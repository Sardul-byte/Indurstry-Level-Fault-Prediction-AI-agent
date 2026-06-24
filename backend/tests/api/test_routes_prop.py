"""
Property-based tests for FastAPI routes and parameter formats.
"""

from __future__ import annotations

import pytest
from hypothesis import given, strategies as st
from fastapi.testclient import TestClient

from app.main import create_app
from app.api.routes.incidents import is_valid_uuid


@given(uuid_str=st.uuids())
def test_property_uuid_validation_valid(uuid_str):
    """Property: Any standard UUID object translates to a valid UUIDv4 string check."""
    assert is_valid_uuid(str(uuid_str)) is True


@given(text=st.text().filter(lambda x: not len(x) == 36))
def test_property_uuid_validation_invalid(text):
    """Property: Random string lengths that are not 36 characters are caught as invalid UUID formats."""
    assert is_valid_uuid(text) is False


def test_invalid_routes_return_404():
    """Verify random endpoints return HTTP 404."""
    app = create_app()
    client = TestClient(app)
    response = client.get("/invalid-endpoint-path")
    assert response.status_code == 404
