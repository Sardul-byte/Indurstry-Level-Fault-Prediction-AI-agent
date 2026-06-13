"""
Generic API response schemas.

Covers error envelopes, health checks, and endpoint-specific
response wrappers for reports, recommendations, and ingestion.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.agent_outputs import PostmortemSection, RemediationStep


class ErrorResponse(BaseModel):
    """Standard error envelope returned on 4xx / 5xx responses."""

    error_code: str
    message: str
    request_id: str


class ReportResponse(BaseModel):
    """Response body for GET /report/{id}."""

    investigation_id: str
    postmortem_status: str
    sections: list[PostmortemSection] | None = None


class RecommendationsResponse(BaseModel):
    """Response body for GET /recommendations/{id}."""

    investigation_id: str
    recommendations_status: str
    steps: list[RemediationStep] | None = None


class IngestResponse(BaseModel):
    """Response body for document ingestion endpoints."""

    job_id: str
    status: str


class HealthResponse(BaseModel):
    """Response body for GET /health."""

    status: str
