"""ORM model for the generated postmortem report.

Each postmortem has a 1-to-1 relationship with its parent Investigation and
stores the seven structured sections produced by the Postmortem_Agent.
"""

from __future__ import annotations

import enum
from datetime import datetime

try:
    from sqlalchemy.dialects.postgresql import JSON
except ImportError:  # pragma: no cover
    from sqlalchemy import JSON  # type: ignore[assignment]

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PostmortemStatus(str, enum.Enum):
    pending = "pending"
    ready = "ready"
    incomplete_inputs = "incomplete_inputs"


class Postmortem(Base):
    """Generated postmortem report for a completed investigation."""

    __tablename__ = "postmortems"

    # PK == investigation_id (1-to-1 relationship)
    id: Mapped[str] = mapped_column(
        String,
        ForeignKey("investigations.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Seven-section content map produced by Postmortem_Agent
    sections: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Current readiness of the postmortem
    status: Mapped[PostmortemStatus] = mapped_column(
        String,
        nullable=False,
        default=PostmortemStatus.pending,
    )

    # Server-side creation timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Postmortem id={self.id!r} status={self.status!r}>"
