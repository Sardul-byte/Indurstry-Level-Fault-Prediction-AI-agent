"""
Embedding and reranking model singletons.

Both are lazily initialised on first access and cached for the lifetime of the
process, avoiding repeated model downloads inside a single worker.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.logging import get_logger

logger = get_logger(__name__)

_EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
_RERANK_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"


@lru_cache(maxsize=1)
def get_embedder():
    """Return the cached SentenceTransformer embedding model.

    Uses ``all-MiniLM-L6-v2`` which produces 384-dimensional vectors and is
    small enough to run on CPU in production.
    """
    from sentence_transformers import SentenceTransformer  # noqa: PLC0415

    logger.info("loading_embedding_model", model=_EMBED_MODEL_NAME)
    model = SentenceTransformer(_EMBED_MODEL_NAME)
    logger.info("embedding_model_loaded", model=_EMBED_MODEL_NAME)
    return model


@lru_cache(maxsize=1)
def get_reranker():
    """Return the cached CrossEncoder reranking model.

    Uses ``cross-encoder/ms-marco-MiniLM-L-6-v2`` which scores (query, passage)
    pairs with a float in [0, 1].
    """
    from sentence_transformers import CrossEncoder  # noqa: PLC0415

    logger.info("loading_reranker_model", model=_RERANK_MODEL_NAME)
    model = CrossEncoder(_RERANK_MODEL_NAME)
    logger.info("reranker_model_loaded", model=_RERANK_MODEL_NAME)
    return model
