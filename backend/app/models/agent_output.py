"""ORM model for persisting individual agent outputs.

One row is written per agent per investigation, preserving the full
serialised output so partial results survive failures and can be
replayed or inspected later.
"""

from __future__ import annotations

from datetime import datetime

try:
    from sqlalchemy.dialects.postgresql import JSON
except ImportError:  # pragma: no cover
    from sqlalchemy import JSON  # type: ignore[assignment]

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AgentOutput(Base):
    """Stores the serialised output produced by each agent in the pipeline."""

    __tablename__ = "agent_outputs"

    __table_args__ = (
        # Speeds up "fetch all outputs for an investigation" queries
        Index("ix_agent_outputs_investigation_id", "investigation_id"),
    )

    # Auto-increment surrogate key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Parent investigation
    investigation_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("investigations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Which agent produced this output (e.g. "alert_agent", "rca_agent")
    agent_name: Mapped[str] = mapped_column(String, nullable=False)

    # Full serialised Pydantic model output
    output: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Server-side creation timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<AgentOutput id={self.id!r} investigation_id={self.investigation_id!r}"
            f" agent_name={self.agent_name!r}>"
        )
