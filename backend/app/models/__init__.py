"""ORM model registry.

Importing this package registers all SQLAlchemy models with ``Base.metadata``,
which is required for ``create_all`` / Alembic autogenerate to discover every
table.  Always import from here rather than from individual model modules so
the registration side-effect is guaranteed to run.
"""

from app.models.agent_output import AgentOutput
from app.models.base import Base
from app.models.investigation import Investigation, InvestigationStatus, WorkflowStage
from app.models.postmortem import Postmortem, PostmortemStatus
from app.models.ragas_metrics import RAGASMetrics

__all__ = [
    # Base
    "Base",
    # Models
    "Investigation",
    "AgentOutput",
    "Postmortem",
    "RAGASMetrics",
    # Enums
    "InvestigationStatus",
    "WorkflowStage",
    "PostmortemStatus",
]
