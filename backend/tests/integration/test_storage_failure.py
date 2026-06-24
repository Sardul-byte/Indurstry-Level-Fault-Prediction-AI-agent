"""
Integration tests for database connection storage failures.
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.orchestrator.graph import execute_agent_node
from app.models.investigation import InvestigationStatus
from app.schemas.agent_outputs import AlertSummary


@pytest.mark.asyncio
async def test_durable_storage_failure_fails_gracefully():
    """Verify that if database is down during execution, orchestrator fails state gracefully."""
    mock_agent = MagicMock()
    mock_agent.agent_name = "alert_agent"
    
    mock_summary = MagicMock(spec=AlertSummary)
    mock_summary.model_dump.return_value = {"summary": "Alert text"}
    mock_agent.run = AsyncMock(return_value={"alert_summary": mock_summary})
    mock_agent._validate_output.return_value = mock_summary

    # Force database save to fail
    mock_session = AsyncMock()
    mock_session.__aenter__.return_value = mock_session
    mock_session.begin.side_effect = Exception("Database connection lost")

    state = {
        "investigation_id": "inv-storage-test",
        "error": None
    }

    with patch("app.orchestrator.graph.AsyncSessionLocal", return_value=mock_session):
        res = await execute_agent_node(mock_agent, state, "triaging")
        assert "error" in res
        assert res["error"]["agent_name"] == "alert_agent"
        assert res["error"]["error_type"] == "StorageError"
