"""
Qdrant client singleton.

Returns a module-level cached ``QdrantClient`` instance configured from
``settings.QDRANT_URL`` and ``settings.QDRANT_COLLECTION``.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@lru_cache(maxsize=1)
def get_qdrant_client():
    """Return a cached synchronous QdrantClient.

    The client is initialised lazily on first access and reused for the
    lifetime of the process.  We use the synchronous client because embedding
    and reranking are also CPU-bound operations run via a thread-pool executor
    — keeping everything in the same thread keeps connection semantics simple.
    """
    from qdrant_client import QdrantClient  # noqa: PLC0415
    from qdrant_client.models import Distance, VectorParams  # noqa: PLC0415

    if settings.QDRANT_URL == ":memory:":
        logger.info("connecting_qdrant_in_memory")
        client = QdrantClient(location=":memory:")
        existing = client.get_collections()
        existing_names = {c.name for c in existing.collections}
        if settings.QDRANT_COLLECTION not in existing_names:
            client.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE),
            )
            logger.info("qdrant_in_memory_collection_created", collection=settings.QDRANT_COLLECTION)
        logger.info("qdrant_connected_in_memory")
    else:
        logger.info("connecting_qdrant", url=settings.QDRANT_URL)
        client = QdrantClient(url=settings.QDRANT_URL)
        logger.info("qdrant_connected", url=settings.QDRANT_URL)
    return client
