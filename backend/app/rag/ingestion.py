"""
RAG document ingestion pipeline.

Supports PDF (PyMuPDF), Markdown, and plain-text formats.
Uses RecursiveCharacterTextSplitter (chunk_size=512, overlap=64).
Embeds with sentence-transformers all-MiniLM-L6-v2.
Upserts to Qdrant with atomic rollback on failure.
Entire pipeline wrapped in a 60-second asyncio timeout.

Usage::

    result = await ingest_document(
        document_name="runbook-2024.pdf",
        file_content=raw_bytes,
        content_type="pdf",
        source_path="/uploads/runbook-2024.pdf",
    )
    # result == {"status": "ok", "chunks_indexed": 42}
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Literal

import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client.models import PointStruct

from app.core.config import settings
from app.core.logging import get_logger
from app.rag.embedder import get_embedder
from app.rag.qdrant_client import get_qdrant_client

logger = get_logger(__name__)

SupportedFormat = Literal["pdf", "markdown", "text"]

# Chunk parameters – must match the retrieval-side expectation.
_CHUNK_SIZE = 512
_CHUNK_OVERLAP = 64

# Overall timeout for a single ingestion job.
_INGESTION_TIMEOUT_SECONDS = 60


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _load_text_from_pdf(file_content: bytes) -> str:
    """Extract all page text from a PDF byte string using PyMuPDF (fitz)."""
    doc = fitz.open(stream=file_content, filetype="pdf")
    pages: list[str] = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n".join(pages)


def _load_text_from_bytes(file_content: bytes, content_type: SupportedFormat) -> str:
    """Decode plain-text or Markdown bytes to a UTF-8 string."""
    return file_content.decode("utf-8", errors="replace")


def _extract_text(file_content: bytes, content_type: SupportedFormat) -> str:
    """Dispatch to the appropriate loader based on *content_type*."""
    if content_type == "pdf":
        return _load_text_from_pdf(file_content)
    # Both "markdown" and "text" are treated as UTF-8 plain text.
    return _load_text_from_bytes(file_content, content_type)


def _split_text(text: str) -> list[str]:
    """Split *text* into chunks using RecursiveCharacterTextSplitter."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=_CHUNK_SIZE,
        chunk_overlap=_CHUNK_OVERLAP,
    )
    return splitter.split_text(text)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def ingest_document(
    document_name: str,
    file_content: bytes,
    content_type: SupportedFormat,
    source_path: str = "",
) -> dict:
    """Ingest a document into the Qdrant vector store.

    Parameters
    ----------
    document_name:
        Human-readable name stored as point metadata (e.g. "runbook-2024.pdf").
    file_content:
        Raw bytes of the document.
    content_type:
        One of ``"pdf"``, ``"markdown"``, or ``"text"``.
    source_path:
        Optional filesystem or URL path stored as point metadata.

    Returns
    -------
    dict
        ``{"status": "ok", "chunks_indexed": N}`` on success.

    Raises
    ------
    asyncio.TimeoutError
        If the entire pipeline takes longer than 60 seconds.
    Exception
        Any other error raised during loading, splitting, embedding, or
        upserting — after rolling back any partial writes to Qdrant.

    Notes
    -----
    The whole coroutine is wrapped in ``asyncio.wait_for(timeout=60)``.
    If an exception occurs after some chunks have been upserted, the
    pipeline calls ``qdrant_client.delete()`` on all written point IDs
    before re-raising (atomic rollback).
    """
    return await asyncio.wait_for(
        _ingest_pipeline(document_name, file_content, content_type, source_path),
        timeout=_INGESTION_TIMEOUT_SECONDS,
    )


async def _ingest_pipeline(
    document_name: str,
    file_content: bytes,
    content_type: SupportedFormat,
    source_path: str,
) -> dict:
    """Core ingestion logic (no timeout wrapper — caller adds it)."""
    logger.info(
        "ingestion_started",
        document_name=document_name,
        content_type=content_type,
        source_path=source_path,
    )

    # Track every point ID written so we can roll back on failure.
    written_ids: list[str] = []
    qdrant = get_qdrant_client()
    collection_name = settings.QDRANT_COLLECTION

    try:
        # ── Step 1: Load text ──────────────────────────────────────────────
        text = _extract_text(file_content, content_type)

        # ── Step 2: Split ──────────────────────────────────────────────────
        chunks: list[str] = _split_text(text)
        if not chunks:
            logger.warning("ingestion_no_chunks", document_name=document_name)
            return {"status": "ok", "chunks_indexed": 0}

        # ── Step 3: Embed (CPU-bound → thread pool) ────────────────────────
        embedder = get_embedder()
        loop = asyncio.get_event_loop()
        vectors = await loop.run_in_executor(None, embedder.encode, chunks)
        # ``vectors`` is an ndarray of shape (len(chunks), 384).

        # ── Step 4: Build Qdrant points ────────────────────────────────────
        points: list[PointStruct] = []
        for chunk_index, (chunk_text, vector) in enumerate(zip(chunks, vectors)):
            point_id = str(uuid.uuid4())
            written_ids.append(point_id)
            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector.tolist(),
                    payload={
                        "document_name": document_name,
                        "section": f"chunk_{chunk_index}",
                        "source_path": source_path,
                        "chunk_index": chunk_index,
                        "content": chunk_text,
                    },
                )
            )

        # ── Step 5: Upsert to Qdrant ───────────────────────────────────────
        await qdrant.upsert(collection_name=collection_name, points=points)

        logger.info(
            "ingestion_completed",
            document_name=document_name,
            chunks_indexed=len(chunks),
        )
        return {"status": "ok", "chunks_indexed": len(chunks)}

    except Exception:
        # ── Atomic rollback: delete any points already written ─────────────
        if written_ids:
            logger.warning(
                "ingestion_rolling_back",
                document_name=document_name,
                points_to_delete=len(written_ids),
            )
            try:
                await qdrant.delete(
                    collection_name=collection_name,
                    points_selector=written_ids,
                )
                logger.info(
                    "ingestion_rollback_complete",
                    document_name=document_name,
                    deleted=len(written_ids),
                )
            except Exception as rollback_exc:
                # Log the rollback failure but still re-raise the original error.
                logger.error(
                    "ingestion_rollback_failed",
                    document_name=document_name,
                    rollback_error=str(rollback_exc),
                )
        raise
