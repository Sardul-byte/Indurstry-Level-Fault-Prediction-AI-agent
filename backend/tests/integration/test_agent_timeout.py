"""
Integration tests for SRE agent timeout configurations.
"""

from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.orchestrator.graph import execute_agent_node
from app.models.investigation import InvestigationStatus


@pytest.mark.asyncio
async def test_agent_node_execution_timeout_triggers_failure():
    """Verify that agent failure propagates correctly and investigation status is marked failed on timeout."""
    mock_agent = MagicMock()
    mock_agent.agent_name = "rca_agent"
    # Force agent to simulate timeout exception
    mock_agent.run = AsyncMock(side_effect=asyncio.TimeoutError("Timeout limit exceeded"))

    state = {
        "investigation_id": "inv-timeout-test",
        "error": None
    }

    mock_session = AsyncMock()
    mock_session.__aenter__.return_value = mock_session
    mock_session.add = MagicMock()
    mock_session.begin = MagicMock(return_value=AsyncMock())
    
    mock_investigation = MagicMock()
    mock_investigation.status = InvestigationStatus.running
    mock_investigation.stage = "root_cause_analysis"
    
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = mock_investigation
    mock_session.execute.return_value = mock_res

    with patch("app.orchestrator.graph.AsyncSessionLocal", return_value=mock_session):
        res = await execute_agent_node(mock_agent, state, "remediation")
        assert "error" in res
        assert res["error"]["agent_name"] == "rca_agent"
        assert res["error"]["error_type"] == "TimeoutError"
        assert mock_investigation.status == InvestigationStatus.failed
        assert mock_investigation.stage == "timed_out"
