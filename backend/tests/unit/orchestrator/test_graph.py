"""Unit tests for the LangGraph orchestrator and routing logic."""

from __future__ import annotations

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.orchestrator.graph import (
    route_after_alert,
    route_after_log_analysis,
    route_after_retrieval,
    route_after_rca,
    route_after_reremediation,
    execute_agent_node,
    app_graph,
)
from app.models.investigation import InvestigationStatus, WorkflowStage
from app.schemas.agent_outputs import AlertSummary


def test_routing_after_alert():
    """Verify route_after_alert returns correct node based on errors."""
    state_no_error = {"error": None}
    assert route_after_alert(state_no_error) == "log_analysis_agent"

    state_with_error = {"error": {"agent_name": "alert_agent", "message": "Failed"}}
    assert route_after_alert(state_with_error) == "error_handler"


def test_routing_after_log_analysis():
    """Verify route_after_log_analysis returns correct node based on errors."""
    state_no_error = {"error": None}
    assert route_after_log_analysis(state_no_error) == "retrieval_agent"

    state_with_error = {"error": {"agent_name": "log_analysis_agent", "message": "Failed"}}
    assert route_after_log_analysis(state_with_error) == "error_handler"


def test_routing_after_retrieval():
    """Verify route_after_retrieval returns correct node based on errors."""
    state_no_error = {"error": None}
    assert route_after_retrieval(state_no_error) == "rca_agent"

    state_with_error = {"error": {"agent_name": "retrieval_agent", "message": "Failed"}}
    assert route_after_retrieval(state_with_error) == "error_handler"


def test_routing_after_rca():
    """Verify route_after_rca returns correct node based on errors."""
    state_no_error = {"error": None}
    assert route_after_rca(state_no_error) == "remediation_agent"

    state_with_error = {"error": {"agent_name": "rca_agent", "message": "Failed"}}
    assert route_after_rca(state_with_error) == "error_handler"


def test_routing_after_remediation():
    """Verify route_after_reremediation returns correct node based on errors."""
    state_no_error = {"error": None}
    assert route_after_reremediation(state_no_error) == "postmortem_agent"

    state_with_error = {"error": {"agent_name": "remediation_agent", "message": "Failed"}}
    assert route_after_reremediation(state_with_error) == "error_handler"


def test_graph_compiles():
    """Verify LangGraph compiles successfully."""
    assert app_graph is not None
    # Check that entry point and nodes exist
    nodes = app_graph.nodes
    assert "alert_agent" in nodes
    assert "log_analysis_agent" in nodes
    assert "retrieval_agent" in nodes
    assert "rca_agent" in nodes
    assert "remediation_agent" in nodes
    assert "postmortem_agent" in nodes
    assert "error_handler" in nodes


@pytest.mark.asyncio
async def test_execute_agent_node_skips_on_error():
    """Verify execute_agent_node does nothing if state already has an error."""
    mock_agent = MagicMock()
    state = {
        "investigation_id": "test-id",
        "error": {"agent_name": "prev_agent", "message": "Failed"},
    }
    res = await execute_agent_node(mock_agent, state, "root_cause_analysis")
    assert res is None
    mock_agent.run.assert_not_called()


@pytest.mark.asyncio
async def test_execute_agent_node_success():
    """Verify execute_agent_node executes agent, validates schema, and writes to database."""
    mock_agent = MagicMock()
    mock_agent.agent_name = "alert_agent"
    
    mock_summary = MagicMock(spec=AlertSummary)
    mock_summary.model_dump.return_value = {"summary": "Alert summary text"}
    mock_agent.run = AsyncMock(return_value={"alert_summary": mock_summary})
    mock_agent._validate_output.return_value = mock_summary

    state = {
        "investigation_id": "test-id-123",
        "error": None,
    }

    # Mock DB interaction
    mock_session = AsyncMock()
    mock_session.__aenter__.return_value = mock_session
    mock_session.add = MagicMock()
    mock_session.begin = MagicMock(return_value=AsyncMock())
    mock_investigation = MagicMock()
    mock_investigation.stage = "triaging"
    mock_investigation.status = InvestigationStatus.running

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_investigation
    mock_session.execute.return_value = mock_result

    with patch("app.orchestrator.graph.AsyncSessionLocal") as mock_session_local:
        # AsyncSessionLocal is used as:
        # async with AsyncSessionLocal() as session:
        #   async with session.begin():
        mock_session_local.return_value = mock_session

        res = await execute_agent_node(mock_agent, state, "triaging")

        assert res == {"alert_summary": mock_summary}
        mock_agent.run.assert_called_once_with(state)
        mock_agent._validate_output.assert_called_once()
        mock_session.add.assert_called_once() # Should add AgentOutput
        assert mock_investigation.stage == "triaging"
        assert mock_investigation.status == InvestigationStatus.running


@pytest.mark.asyncio
async def test_execute_agent_node_handles_agent_failure():
    """Verify execute_agent_node catches exceptions, logs them, and sets investigation status to failed."""
    mock_agent = MagicMock()
    mock_agent.agent_name = "rca_agent"
    mock_agent.run = AsyncMock(side_effect=asyncio.TimeoutError("RCA Agent Timed Out"))

    state = {
        "investigation_id": "test-id-123",
        "error": None,
    }

    mock_session = AsyncMock()
    mock_session.__aenter__.return_value = mock_session
    mock_session.add = MagicMock()
    mock_session.begin = MagicMock(return_value=AsyncMock())
    mock_investigation = MagicMock()
    mock_investigation.stage = "triaging"
    mock_investigation.status = InvestigationStatus.running

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_investigation
    mock_session.execute.return_value = mock_result

    with patch("app.orchestrator.graph.AsyncSessionLocal") as mock_session_local:
        mock_session_local.return_value = mock_session

        res = await execute_agent_node(mock_agent, state, "remediation")

        assert "error" in res
        assert res["error"]["agent_name"] == "rca_agent"
        assert res["error"]["error_type"] == "TimeoutError"
        assert res["error"]["message"] == "RCA Agent Timed Out"
        
        # Verify db called to fail investigation and set stage on timeout
        assert mock_investigation.status == InvestigationStatus.failed
        assert mock_investigation.stage == "timed_out"
