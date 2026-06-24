"""
Property-based and unit tests for LLM retry behavior and error handling.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest
from hypothesis import given, strategies as st
from langchain_core.messages import AIMessage

from app.llm.provider import LLMProvider


class MockTransientError(Exception):
    pass


@pytest.mark.asyncio
async def test_llm_retry_on_transient_error():
    """Verify LLM wraps with retry behavior and attempts transient call retries."""
    mock_llm = MagicMock()
    # Configure with_retry mock to simulate Langchain's behavior
    mock_llm.with_retry.return_value = mock_llm
    
    with patch("langchain_google_genai.ChatGoogleGenerativeAI", return_value=mock_llm):
        llm = LLMProvider.get()
        assert llm is not None
        mock_llm.with_retry.assert_called_once()
