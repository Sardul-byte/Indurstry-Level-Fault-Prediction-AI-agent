"""Unit tests for LogAnalysisAgent."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.log_analysis_agent import LogAnalysisAgent, RawErrorLog
from app.schemas.agent_outputs import LogSummary


@pytest.mark.asyncio
async def test_log_analysis_agent_anomalies_and_patterns():
    """Verify LogAnalysisAgent groups anomalies (>3) and failure patterns (>=3) correctly."""
    agent = LogAnalysisAgent()
    state = {
        "log_data": "dummy logs"
    }

    # Simulate 4 database connection errors (anomaly & pattern)
    # Simulate 3 validation errors (pattern only)
    mock_errors = []
    for _ in range(4):
        mock_errors.append(
            RawErrorLog(
                error_type="ConnectionTimeout",
                service_name="payment-service",
                signature="ConnectionTimeout: DB connection failed"
            )
        )
    for _ in range(3):
        mock_errors.append(
            RawErrorLog(
                error_type="ValidationError",
                service_name="payment-service",
                signature="ValidationError: invalid card number"
            )
        )

    with patch("app.llm.provider.LLMProvider.get") as mock_get:
        mock_llm = MagicMock()
        mock_structured = AsyncMock()
        mock_llm.with_structured_output.return_value = mock_structured
        mock_structured.ainvoke.return_value = MagicMock(errors=mock_errors)
        mock_get.return_value = mock_llm

        res = await agent.run(state)
        
        assert "log_summary" in res
        summary = res["log_summary"]
        assert isinstance(summary, LogSummary)
        assert summary.analysis_status == "ok"
        
        # ConnectionTimeout should be an anomaly (count = 4 > 3)
        assert "ConnectionTimeout::payment-service" in summary.anomalies
        assert summary.anomalies["ConnectionTimeout::payment-service"].count == 4
        
        # ValidationError should NOT be an anomaly (count = 3 is not > 3)
        assert "ValidationError::payment-service" not in summary.anomalies
        
        # Both should be in failure patterns (count >= 3)
        signatures = [p.signature for p in summary.failure_patterns]
        assert "ConnectionTimeout: DB connection failed" in signatures
        assert "ValidationError: invalid card number" in signatures
        assert len(summary.failure_patterns) == 2


@pytest.mark.asyncio
async def test_log_analysis_agent_empty_logs():
    """Verify LogAnalysisAgent falls back on empty logs."""
    agent = LogAnalysisAgent()
    state = {"log_data": ""}

    res = await agent.run(state)
    assert "log_summary" in res
    summary = res["log_summary"]
    assert summary.analysis_status == "insufficient_data"
    assert len(summary.anomalies) == 0
    assert len(summary.failure_patterns) == 0
