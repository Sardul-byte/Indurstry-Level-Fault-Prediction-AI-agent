"""
Integration tests for the RAG ingestion and retrieval pipeline.
"""

from __future__ import annotations

import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.rag.ingestion import ingest_document


@pytest.mark.asyncio
async def test_ingest_document_mocked_success():
    """Verify document ingestion flow executes successfully with mocked Qdrant client and mock embedder."""
    mock_client = MagicMock()
    mock_client.upsert = AsyncMock(return_value=True)
    mock_client.delete = AsyncMock()

    mock_embedder = MagicMock()
    mock_embedder.encode.side_effect = lambda chunks: np.zeros((len(chunks), 384))

    with patch("app.rag.ingestion.get_qdrant_client", return_value=mock_client), \
         patch("app.rag.ingestion.get_embedder", return_value=mock_embedder):
         
        # Ingest sample text document
        file_content = b"This is a sample SRE runbook for postgres failures."
        await ingest_document(
            document_name="postgres_fail.txt",
            file_content=file_content,
            content_type="text"
        )
        assert mock_client.upsert.called
        assert mock_embedder.encode.called
