"""
RAG retrieval pipeline.

1. Build composite query from AlertSummary + LogSummary top anomalies
2. Embed query with all-MiniLM-L6-v2
3. Qdrant search(limit=K), filter below similarity threshold
4. Rerank with cross-encoder/ms-marco-MiniLM-L-6-v2
5. Truncate each excerpt to ≤500 words
6. Return RetrievalContext
"""

from __future__ import annotations

import asyncio
from functools import partial

from app.core.config import settings
from app.core.logging import get_logger
from app.rag.embedder import get_embedder, get_reranker
from app.rag.qdrant_client import get_qdrant_client
from app.schemas.agent_outputs import (
    AlertSummary,
    DocumentExcerpt,
    LogSummary,
    RetrievalContext,
)

logger = get_logger(__name__)

# Maximum number of top anomaly signatures added to the query.
_TOP_ANOMALIES = 3
# Maximum words per excerpt returned to callers.
_MAX_EXCERPT_WORDS = 500


def _build_query(
    alert_summary: AlertSummary | None,
    log_summary: LogSummary | None,
) -> str:
    """Compose a query string from alert metadata and top log anomalies.

    Returns an empty string only when both inputs are None; callers should
    detect that case and short-circuit before reaching Qdrant.
    """
    parts: list[str] = []

    if alert_summary is not None:
        parts.append(alert_summary.alert_type)
        parts.append(alert_summary.severity)
        parts.extend(alert_summary.impacted_services)

    if log_summary is not None:
        # Use the top-N anomaly signatures as additional query signal.
        anomaly_signatures = [
            f"{entry.error_type} {entry.service_name}"
            for entry in list(log_summary.anomalies.values())[:_TOP_ANOMALIES]
        ]
        parts.extend(anomaly_signatures)

    return " ".join(parts).strip()


def _embed_query(query: str) -> list[float]:
    """Embed *query* using the cached SentenceTransformer model.

    Intended to be run inside a thread-pool executor.
    """
    embedder = get_embedder()
    vector = embedder.encode(query, convert_to_numpy=True)
    return vector.tolist()


def _rerank(query: str, passages: list[str]) -> list[float]:
    """Score each (query, passage) pair with the cached CrossEncoder.

    Returns a list of float scores aligned positionally with *passages*.
    Intended to be run inside a thread-pool executor.
    """
    reranker = get_reranker()
    pairs = [(query, p) for p in passages]
    scores: list[float] = reranker.predict(pairs).tolist()
    return scores


def _truncate_to_words(text: str, max_words: int = _MAX_EXCERPT_WORDS) -> str:
    """Return *text* with at most *max_words* whitespace-delimited tokens."""
    return " ".join(text.split()[:max_words])


async def retrieve(
    alert_summary: AlertSummary | None,
    log_summary: LogSummary | None,
    k: int | None = None,
) -> RetrievalContext:
    """Retrieve relevant knowledge-base documents.

    Args:
        alert_summary: Output from Alert_Agent (may be None).
        log_summary: Output from Log_Analysis_Agent (may be None).
        k: Override for RAG_K setting (1–20).  Defaults to ``settings.RAG_K``.

    Returns:
        :class:`RetrievalContext` with ranked excerpts, or
        ``retrieval_status="no_relevant_context"`` when nothing passes the
        similarity threshold.
    """
    # ── 0. Short-circuit when there is no input ────────────────────────────
    if alert_summary is None and log_summary is None:
        logger.info("retrieval_skipped", reason="no_input")
        return RetrievalContext(excerpts=[], retrieval_status="no_relevant_context")

    # ── 1. Build composite query ───────────────────────────────────────────
    query = _build_query(alert_summary, log_summary)
    if not query:
        logger.info("retrieval_skipped", reason="empty_query")
        return RetrievalContext(excerpts=[], retrieval_status="no_relevant_context")

    effective_k: int = k if k is not None else settings.RAG_K
    logger.info("retrieval_start", query_preview=query[:120], k=effective_k)

    try:
        # ── 2. Embed query (CPU-bound → thread pool) ───────────────────────────
        loop = asyncio.get_running_loop()
        query_vector: list[float] = await loop.run_in_executor(
            None, partial(_embed_query, query)
        )

        # ── 3. Qdrant nearest-neighbour search ────────────────────────────────
        qdrant = get_qdrant_client()
        search_results = await loop.run_in_executor(
            None,
            partial(
                qdrant.search,
                collection_name=settings.QDRANT_COLLECTION,
                query_vector=query_vector,
                limit=effective_k,
                with_payload=True,
            ),
        )
    except Exception as exc:
        logger.warning(
            "retrieval_qdrant_error_falling_back",
            error=str(exc),
        )
        return RetrievalContext(excerpts=[], retrieval_status="no_relevant_context")

    logger.info("qdrant_results", total=len(search_results))

    # ── 4. Cosine-similarity threshold filter ─────────────────────────────
    above_threshold = [
        hit for hit in search_results if hit.score >= settings.RAG_SIMILARITY_THRESHOLD
    ]

    if not above_threshold:
        logger.info(
            "retrieval_no_results",
            threshold=settings.RAG_SIMILARITY_THRESHOLD,
        )
        return RetrievalContext(excerpts=[], retrieval_status="no_relevant_context")

    # ── 5. Cross-encoder reranking (CPU-bound → thread pool) ───────────────
    passages: list[str] = [
        (hit.payload or {}).get("content", "") for hit in above_threshold
    ]
    reranker_scores: list[float] = await loop.run_in_executor(
        None, partial(_rerank, query, passages)
    )

    # ── 6. Assemble excerpts, truncate, and sort ───────────────────────────
    excerpts: list[DocumentExcerpt] = []
    for hit, content, score in zip(above_threshold, passages, reranker_scores, strict=True):
        payload = hit.payload or {}
        truncated = _truncate_to_words(content)
        # Clamp score to [0, 1] — CrossEncoder output is already in this range
        # but guard against floating-point artefacts.
        clamped_score = max(0.0, min(1.0, float(score)))
        excerpts.append(
            DocumentExcerpt(
                content=truncated,
                document_name=payload.get("document_name", ""),
                section=payload.get("section", ""),
                relevance_score=clamped_score,
            )
        )

    # Sort descending by reranker score.
    excerpts.sort(key=lambda e: e.relevance_score, reverse=True)

    logger.info(
        "retrieval_complete",
        excerpts_returned=len(excerpts),
        top_score=excerpts[0].relevance_score if excerpts else None,
    )

    return RetrievalContext(excerpts=excerpts, retrieval_status="ok")
