"""
FastAPI route handlers for document ingestion into the RAG pipeline.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile
from app.core.logging import get_logger
from app.rag.ingestion import ingest_document
from app.schemas.responses import IngestResponse

logger = get_logger(__name__)
router = APIRouter(tags=["ingest"])


@router.post(
    "/ingest",
    response_model=IngestResponse,
    status_code=202,
    summary="Ingest runbooks or guides into knowledge base",
)
async def ingest_file(
    file: UploadFile,
    background_tasks: BackgroundTasks,
) -> IngestResponse:
    """Upload a PDF, Markdown, or plaintext file to index into the Qdrant vector database.

    Processing runs asynchronously in the background.
    """
    filename = file.filename or "unknown_file"
    
    # 1. Determine content type format
    if filename.endswith(".pdf") or file.content_type == "application/pdf":
        fmt = "pdf"
    elif filename.endswith(".md") or file.content_type == "text/markdown":
        fmt = "markdown"
    elif filename.endswith(".txt") or file.content_type == "text/plain":
        fmt = "text"
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Only PDF, Markdown (.md), and Plaintext (.txt) are allowed.",
        )

    logger.info("file_upload_received", filename=filename, format=fmt)

    # 2. Read file content
    try:
        content = await file.read()
    except Exception as exc:
        logger.error("file_read_failed", filename=filename, error=str(exc))
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read file: {exc}",
        )

    job_id = str(uuid.uuid4())

    # 3. Enqueue ingestion pipeline coroutine in the background
    background_tasks.add_task(
        ingest_document,
        document_name=filename,
        file_content=content,
        content_type=fmt,
        source_path=filename,
    )

    return IngestResponse(
        job_id=job_id,
        status="pending",
    )
