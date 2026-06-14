"""Unit tests for RCAAgent."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.agents.rca_agent import RCAAgent
from app.schemas.agent_outputs import (
    AlertSummary,
    LogSummary,
    RCAResult,
    RootCauseHypothesis,
)


@pytest.mark.asyncio
async def test_rca_agent_valid_execution():
    """Verify RCAAgent successfully returns root cause hypotheses."""
    agent = RCAAgent()
    
    alert_summary = AlertSummary(
        alert_type="availability",
        severity="critical",
        impacted_services=["auth"],
        alert_timestamp=datetime.now(timezone.utc),
        classification_status="classified",
    )
    log_summary = LogSummary(
        anomalies={},
        error_groups={},
        failure_patterns=[],
        analysis_status="ok",
    )
    
    state = {
        "alert_summary": alert_summary,
        "log_summary": log_summary,
        "retrieval_context": None,
    }

    mock_result = RCAResult(
        hypotheses=[
            RootCauseHypothesis(
                hypothesis="Database CPU spikes",
                confidence_score=0.85,
                evidence=["CPU usage at 99%"],
            )
        ],
        analysis_status="ok",
    )

    with patch("app.llm.provider.LLMProvider.get") as mock_get:
        mock_llm = MagicMock()
        mock_structured = AsyncMock()
        mock_llm.with_structured_output.return_value = mock_structured
        mock_structured.ainvoke.return_value = mock_result
        mock_get.return_value = mock_llm

        res = await agent.run(state)
        
        assert "rca_result" in res
        rca = res["rca_result"]
        assert isinstance(rca, RCAResult)
        assert rca.analysis_status == "ok"
        assert len(rca.hypotheses) == 1
        assert rca.hypotheses[0].hypothesis == "Database CPU spikes"
        assert rca.hypotheses[0].confidence_score == 0.85


@pytest.mark.asyncio
async def test_rca_agent_invalid_input_fallback():
    """Verify RCAAgent handles missing inputs by setting invalid_input status."""
    agent = RCAAgent()
    # Missing log_summary
    state = {
        "alert_summary": {},
        "log_summary": None,
    }

    res = await agent.run(state)
    assert "rca_result" in res
    rca = res["rca_result"]
    assert rca.analysis_status == "invalid_input"
    assert len(rca.hypotheses) == 0
