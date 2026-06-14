"""Unit tests for RemediationAgent."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch

from app.agents.remediation_agent import RemediationAgent, RawRemediationStep
from app.schemas.agent_outputs import (
    RCAResult,
    RemediationList,
    RootCauseHypothesis,
)


@pytest.mark.asyncio
async def test_remediation_agent_sorting_and_labelling():
    """Verify steps are prioritized by hypothesis confidence, categorized correctly, and labeled."""
    agent = RemediationAgent()
    
    # 2 hypotheses: one with 0.8 confidence, one with 0.3
    rca = RCAResult(
        hypotheses=[
            RootCauseHypothesis(hypothesis="DB issue", confidence_score=0.8, evidence=["DB lock"]),
            RootCauseHypothesis(hypothesis="Network glitch", confidence_score=0.3, evidence=["Timeout"]),
        ],
        analysis_status="ok",
    )
    state = {"rca_result": rca}

    # Generate 3 steps:
    # 1. code_change for "DB issue" (parent confidence = 0.8)
    # 2. operational for "DB issue" (parent confidence = 0.8)
    # 3. configuration for "Network glitch" (parent confidence = 0.3)
    mock_steps = [
        RawRemediationStep(
            action="Apply SQL query patch",
            category="code_change",
            rationale="Addresses database locking",
            target_hypothesis="DB issue",
        ),
        RawRemediationStep(
            action="Restart Database",
            category="operational",
            rationale="Clears existing DB locks",
            target_hypothesis="DB issue",
        ),
        RawRemediationStep(
            action="Increase network timeout env",
            category="configuration",
            rationale="Mitigates transient network drops",
            target_hypothesis="Network glitch",
        )
    ]

    from unittest.mock import MagicMock
    with patch("app.llm.provider.LLMProvider.get") as mock_get:
        mock_llm = MagicMock()
        mock_structured = AsyncMock()
        mock_llm.with_structured_output.return_value = mock_structured
        mock_structured.ainvoke.return_value = MagicMock(steps=mock_steps)
        mock_get.return_value = mock_llm

        res = await agent.run(state)
        
        assert "remediation_list" in res
        remediations = res["remediation_list"]
        assert isinstance(remediations, RemediationList)
        assert len(remediations.steps) == 3

        # Sorting expectations:
        # Parent score 0.8 is highest -> steps 1 & 2 come first.
        # Between steps 1 & 2, category operational (rank 1) comes before code_change (rank 3).
        # So "Restart Database" must be 1st!
        assert remediations.steps[0].action == "Restart Database"
        assert remediations.steps[0].confidence == "supported" # parent 0.8 >= 0.4
        
        # "Apply SQL query patch" must be 2nd!
        assert remediations.steps[1].action == "Apply SQL query patch"
        assert remediations.steps[1].confidence == "supported" # parent 0.8 >= 0.4

        # "Increase network timeout env" must be 3rd!
        assert remediations.steps[2].action == "Increase network timeout env"
        assert remediations.steps[2].confidence == "speculative" # parent 0.3 < 0.4
