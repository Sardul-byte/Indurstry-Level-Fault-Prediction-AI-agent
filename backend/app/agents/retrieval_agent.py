"""
Retrieval Agent implementation.

Queries the Qdrant vector database using embeddings derived from alert and log summaries,
and returns a structured RetrievalContext.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.agents.base import AgentBase
from app.rag.retrieval import retrieve
from app.schemas.agent_outputs import RetrievalContext


class RetrievalAgent(AgentBase):
    """Agent responsible for querying Vector Store to get SRE runbooks and past incident logs."""

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Execute retrieval step.

        Args:
            state: InvestigationState dict.

        Returns:
            Dict containing the 'retrieval_context' key.
        """
        alert_summary = state.get("alert_summary")
        log_summary = state.get("log_summary")

        # Calls retrieve from app.rag.retrieval
        context = await retrieve(alert_summary, log_summary)

        return {"retrieval_context": context}

    def output_schema(self) -> type[BaseModel]:
        return RetrievalContext
