"""
Pydantic output models for each agent in the pipeline.

Each model is the validated output schema for one agent stage.
Named to avoid clashes with SQLAlchemy ORM models in app.models.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Log Analysis Agent helpers
# ---------------------------------------------------------------------------

class AnomalyEntry(BaseModel):
    """A single anomaly detected by the Log_Analysis_Agent (count > 3)."""

    error_type: str
    service_name: str
    count: int


class ErrorGroup(BaseModel):
    """Grouped error occurrences from the log corpus."""

    error_type: str
    service_name: str
    count: int


class FailurePattern(BaseModel):
    """A recurring failure signature (count >= 3)."""

    signature: str
    count: int


# ---------------------------------------------------------------------------
# Alert Agent output
# ---------------------------------------------------------------------------

class AlertSummary(BaseModel):
    """Output of the Alert_Agent: classified alert metadata."""

    model_config = ConfigDict(from_attributes=True)

    alert_type: Literal[
        "availability",
        "performance",
        "error_rate",
        "resource",
        "security",
        "custom",
    ]
    severity: Literal["critical", "high", "medium", "low"]
    impacted_services: list[str] = Field(default_factory=list, max_length=20)
    alert_timestamp: datetime
    classification_status: Literal["classified", "unclassified", "parse_error"]


# ---------------------------------------------------------------------------
# Log Analysis Agent output
# ---------------------------------------------------------------------------

class LogSummary(BaseModel):
    """Output of the Log_Analysis_Agent."""

    model_config = ConfigDict(from_attributes=True)

    # key format: "{error_type}::{service_name}"
    anomalies: dict[str, AnomalyEntry]
    error_groups: dict[str, ErrorGroup]
    failure_patterns: list[FailurePattern]
    analysis_status: Literal["ok", "insufficient_data"]


# ---------------------------------------------------------------------------
# Retrieval Agent output
# ---------------------------------------------------------------------------

class DocumentExcerpt(BaseModel):
    """A single retrieved document chunk with metadata."""

    content: str  # ≤ 500 words enforced at agent level
    document_name: str
    section: str
    relevance_score: float = Field(ge=0.0, le=1.0)


class RetrievalContext(BaseModel):
    """Output of the Retrieval_Agent: ranked knowledge-base excerpts."""

    model_config = ConfigDict(from_attributes=True)

    excerpts: list[DocumentExcerpt]
    retrieval_status: Literal["ok", "no_relevant_context"]


# ---------------------------------------------------------------------------
# RCA Agent output
# ---------------------------------------------------------------------------

class RootCauseHypothesis(BaseModel):
    """A single root-cause hypothesis with evidence."""

    hypothesis: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = Field(min_length=1)


class RCAResult(BaseModel):
    """Output of the RCA_Agent: ranked hypotheses."""

    model_config = ConfigDict(from_attributes=True)

    # sorted descending by confidence_score, max 5 entries
    hypotheses: list[RootCauseHypothesis] = Field(default_factory=list, max_length=5)
    analysis_status: Literal["ok", "low_confidence", "invalid_input", "timed_out"]


# ---------------------------------------------------------------------------
# Remediation Agent output
# ---------------------------------------------------------------------------

class RemediationStep(BaseModel):
    """A single remediation action recommended by the Remediation_Agent."""

    action: str
    category: Literal["operational", "configuration", "code_change"]
    rationale: str
    confidence: Literal["supported", "speculative"]


class RemediationList(BaseModel):
    """Output of the Remediation_Agent: ordered remediation steps."""

    model_config = ConfigDict(from_attributes=True)

    # sorted desc by parent hypothesis confidence, then by category order;
    # max 10 entries
    steps: list[RemediationStep] = Field(default_factory=list, max_length=10)


# ---------------------------------------------------------------------------
# Postmortem Agent output
# ---------------------------------------------------------------------------

class PostmortemSection(BaseModel):
    """One section of the generated postmortem document."""

    heading: str
    body: str
    source_agent: str


class PostmortemSchema(BaseModel):
    """
    Output of the Postmortem_Agent.

    Named ``PostmortemSchema`` (not ``Postmortem``) to avoid collision with
    the SQLAlchemy ORM model ``app.models.Postmortem``.
    """

    model_config = ConfigDict(from_attributes=True)

    investigation_id: str
    # exactly 7 sections (enforced at agent level; min_length + max_length here)
    sections: list[PostmortemSection] = Field(min_length=7, max_length=7)
    postmortem_status: Literal["ready", "pending", "incomplete_inputs"]
    missing_inputs: list[str] = []
