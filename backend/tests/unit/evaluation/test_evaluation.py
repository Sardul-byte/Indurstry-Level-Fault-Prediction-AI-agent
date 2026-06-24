"""
Unit tests for the RAGAS metrics evaluation pipeline.
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.evaluation.ragas_evaluator import evaluate_investigation
from app.models.investigation import Investigation


@pytest.mark.asyncio
async def test_evaluate_investigation_not_found():
    """Verify evaluator returns early without raising exceptions if investigation not found."""
    mock_session = AsyncMock()
    mock_session.__aenter__.return_value = mock_session
    mock_session.begin = MagicMock(return_value=AsyncMock())
    mock_session.execute.return_value = MagicMock(scalar_one_or_none=lambda: None)

    with patch("app.evaluation.ragas_evaluator.AsyncSessionLocal", return_value=mock_session):
        # Should execute silently and log error
        await evaluate_investigation("missing-id")
        mock_session.add.assert_not_called()


@pytest.mark.asyncio
async def test_evaluate_investigation_setup_failure_persists_nulls():
    """Verify evaluator persists nulls if LLM/embeddings initialization fails."""
    mock_session = AsyncMock()
    mock_session.__aenter__.return_value = mock_session
    mock_session.begin = MagicMock(return_value=AsyncMock())

    mock_inv = MagicMock(spec=Investigation)
    mock_inv.id = "test-inv-id"
    mock_inv.alert_payload = {}
    mock_inv.log_data = "sample log data"

    # Configure execute to return investigation first, then empty list of outputs
    mock_res_inv = MagicMock()
    mock_res_inv.scalar_one_or_none.return_value = mock_inv

    mock_res_outputs = MagicMock()
    mock_res_outputs.scalars.return_value.all.return_value = []

    mock_session.execute.side_effect = [mock_res_inv, mock_res_outputs]

    with patch("app.evaluation.ragas_evaluator.AsyncSessionLocal", return_value=mock_session), \
         patch("app.evaluation.ragas_evaluator.LLMProvider.get", side_effect=ValueError("LLM Error")):

        await evaluate_investigation("test-inv-id")

        # Verify a RAGASMetrics row was added to session
        mock_session.add.assert_called_once()
        metrics_arg = mock_session.add.call_args[0][0]
        assert metrics_arg.investigation_id == "test-inv-id"
        assert metrics_arg.faithfulness is None
        assert metrics_arg.context_precision is None
        assert metrics_arg.context_recall is None
        assert metrics_arg.answer_relevance is None
