"""
LangGraph shared state definition.
"""

from __future__ import annotations

from typing import Any, TypedDict

from app.schemas.agent_outputs import (
    AlertSummary,
    LogSummary,
    PostmortemSchema,
    RCAResult,
    RemediationList,
    RetrievalContext,
)


class InvestigationState(TypedDict):
    """The shared state dictionary updated by each agent node in the LangGraph pipeline."""

    investigation_id: str
    request_id: str
    
    # Raw incident inputs
    alert_payload: dict[str, Any]
    log_data: str
    metadata: dict[str, Any]

    # Agent outputs (initially None, populated sequentially)
    alert_summary: AlertSummary | None
    log_summary: LogSummary | None
    retrieval_context: RetrievalContext | None
    rca_result: RCAResult | None
    remediation_list: RemediationList | None
    postmortem: PostmortemSchema | None

    # Bookkeeping and routing
    current_stage: str  # one of WorkflowStage values: "triaging", "root_cause_analysis", etc.
    error: dict[str, str] | None  # format: {"agent_name": ..., "error_type": ..., "message": ...}
