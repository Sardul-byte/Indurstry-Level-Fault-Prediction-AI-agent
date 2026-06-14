"""Unit tests for AlertAgent."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.agents.alert_agent import AlertAgent
from app.schemas.agent_outputs import AlertSummary


@pytest.mark.asyncio
async def test_alert_agent_valid_payload():
    """Verify AlertAgent successfully triages a valid alert payload."""
    agent = AlertAgent()
    state = {
        "alert_payload": {
            "type": "availability",
            "severity": "critical",
            "services": ["auth-service", "gateway"],
            "timestamp": "2026-06-14T03:00:00Z"
        }
    }

    # Mock the LLM call using patch on LLMProvider.get()
    mock_summary = AlertSummary(
        alert_type="availability",
        severity="critical",
        impacted_services=["auth-service", "gateway"],
        alert_timestamp=datetime(2026, 6, 14, 3, 0, 0, tzinfo=timezone.utc),
        classification_status="classified",
    )

    with patch("app.llm.provider.LLMProvider.get") as mock_get:
        mock_llm = MagicMock()
        mock_structured = AsyncMock()
        mock_llm.with_structured_output.return_value = mock_structured
        mock_structured.ainvoke.return_value = mock_summary
        mock_get.return_value = mock_llm

        res = await agent.run(state)

        assert "alert_summary" in res
        summary = res["alert_summary"]
        assert isinstance(summary, AlertSummary)
        assert summary.alert_type == "availability"
        assert summary.severity == "critical"
        assert summary.classification_status == "classified"
        assert "auth-service" in summary.impacted_services


@pytest.mark.asyncio
async def test_alert_agent_malformed_payload_fallback():
    """Verify AlertAgent falls back gracefully on missing payload."""
    agent = AlertAgent()
    state = {"alert_payload": None}

    res = await agent.run(state)
    assert "alert_summary" in res
    summary = res["alert_summary"]
    assert summary.classification_status == "parse_error"
    assert summary.alert_type == "custom"
    assert summary.severity == "low"
    assert len(summary.impacted_services) == 0
