"""ORM model for RAGAS evaluation metrics.

Stores the four RAGAS quality scores computed after a completed
investigation so RAG pipeline quality can be tracked over time.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RAGASMetrics(Base):
    """RAGAS quality metrics tied to a single investigation."""

    __tablename__ = "ragas_metrics"

    # PK == investigation_id (1-to-1 relationship)
    investigation_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("investigations.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # RAGAS scores — nullable because computation may be partial or skipped
    faithfulness: Mapped[float | None] = mapped_column(Float, nullable=True)
    context_precision: Mapped[float | None] = mapped_column(Float, nullable=True)
    context_recall: Mapped[float | None] = mapped_column(Float, nullable=True)
    answer_relevance: Mapped[float | None] = mapped_column(Float, nullable=True)

    # When the metrics were computed
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<RAGASMetrics investigation_id={self.investigation_id!r}"
            f" faithfulness={self.faithfulness!r}>"
        )
