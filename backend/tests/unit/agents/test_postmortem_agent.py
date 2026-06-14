"""Unit tests for PostmortemAgent."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.agents.postmortem_agent import PostmortemAgent
from app.schemas.agent_outputs import (
    PostmortemSchema,
    PostmortemSection,
)


@pytest.mark.asyncio
async def test_postmortem_agent_complete_inputs():
    """Verify PostmortemAgent outputs 7 sections with complete inputs."""
    agent = PostmortemAgent()
    
    # Supply dummy objects for all 5 prior stages
    state = {
        "investigation_id": "test-id-123",
        "alert_summary": AsyncMock(),
        "log_summary": AsyncMock(),
        "retrieval_context": AsyncMock(),
        "rca_result": AsyncMock(),
        "remediation_list": AsyncMock(),
    }

    mock_pm = PostmortemSchema(
        investigation_id="test-id-123",
        sections=[
            PostmortemSection(heading="Executive Summary", body="Exec", source_agent="alert_agent"),
            PostmortemSection(heading="Incident Timeline", body="Time", source_agent="log_analysis_agent"),
            PostmortemSection(heading="Impact Assessment", body="Impact", source_agent="alert_agent"),
            PostmortemSection(heading="Root Cause Analysis", body="RCA", source_agent="rca_agent"),
            PostmortemSection(heading="Resolution Steps", body="Resolve", source_agent="remediation_agent"),
            PostmortemSection(heading="Lessons Learned", body="Lessons", source_agent="rca_agent"),
            PostmortemSection(heading="Preventive Actions", body="Prevent", source_agent="remediation_agent"),
        ],
        postmortem_status="ready",
        missing_inputs=[],
    )

    with patch("app.llm.provider.LLMProvider.get") as mock_get:
        mock_llm = MagicMock()
        mock_structured = AsyncMock()
        mock_llm.with_structured_output.return_value = mock_structured
        mock_structured.ainvoke.return_value = mock_pm
        mock_get.return_value = mock_llm

        res = await agent.run(state)
        
        assert "postmortem" in res
        pm = res["postmortem"]
        assert isinstance(pm, PostmortemSchema)
        assert pm.postmortem_status == "ready"
        assert len(pm.sections) == 7
        assert pm.sections[0].heading == "Executive Summary"
        assert pm.sections[6].heading == "Preventive Actions"


@pytest.mark.asyncio
async def test_postmortem_agent_missing_inputs():
    """Verify PostmortemAgent returns incomplete_inputs and placeholder sections if inputs are missing."""
    agent = PostmortemAgent()
    
    # Missing alert_summary and retrieval_context
    state = {
        "investigation_id": "test-id-123",
        "alert_summary": None,
        "log_summary": AsyncMock(),
        "retrieval_context": None,
        "rca_result": AsyncMock(),
        "remediation_list": AsyncMock(),
    }

    res = await agent.run(state)
    
    assert "postmortem" in res
    pm = res["postmortem"]
    assert isinstance(pm, PostmortemSchema)
    assert pm.postmortem_status == "incomplete_inputs"
    assert "alert_summary" in pm.missing_inputs
    assert "retrieval_context" in pm.missing_inputs
    assert len(pm.sections) == 7 # placeholders emitted to satisfy Pydantic bounds
