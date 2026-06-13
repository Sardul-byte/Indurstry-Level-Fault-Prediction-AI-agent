"""
Incident request/response schemas.

Covers API request payloads and top-level response envelopes for
incident submission and investigation status endpoints.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class IncidentPayload(BaseModel):
    """Request body for POST /incident."""

    alert_data: dict
    logs: str
    service_name: str | None = None
    environment: str | None = None
    timestamp: datetime | None = None  # ISO 8601


class IncidentCreateResponse(BaseModel):
    """Response body for POST /incident (HTTP 202)."""

    investigation_id: str
    status: str


class AgentOutputSummary(BaseModel):
    """Lightweight summary of a single agent's persisted output."""

    model_config = ConfigDict(from_attributes=True)

    agent_name: str
    output: dict


class InvestigationStatusResponse(BaseModel):
    """Response body for GET /incident/{id}."""

    model_config = ConfigDict(from_attributes=True)

    investigation_id: str
    status: str
    stage: str
    agent_outputs: list[AgentOutputSummary] = Field(default_factory=list, max_length=100)
