"""
LangGraph orchestrator workflow definition.
"""

from __future__ import annotations

import asyncio
from typing import Any

from langgraph.graph import END, StateGraph
from sqlalchemy import select

from app.core.config import settings
from app.agents.alert_agent import AlertAgent
from app.agents.log_analysis_agent import LogAnalysisAgent
from app.agents.postmortem_agent import PostmortemAgent
from app.agents.rca_agent import RCAAgent
from app.agents.remediation_agent import RemediationAgent
from app.agents.retrieval_agent import RetrievalAgent
from app.core.database import AsyncSessionLocal
from app.core.logging import get_logger
from app.models.agent_output import AgentOutput
from app.models.investigation import Investigation, InvestigationStatus, WorkflowStage
from app.models.postmortem import Postmortem, PostmortemStatus
from app.orchestrator.state import InvestigationState

logger = get_logger(__name__)


async def execute_agent_node(
    agent_instance: Any,
    state: InvestigationState,
    db_stage_after: str,
) -> dict[str, Any]:
    """Helper function to execute an agent logic, validate its schema, and persist it to the DB."""
    agent_name = agent_instance.agent_name
    inv_id = state.get("investigation_id", "")

    # If the state already has an error, skip execution
    if state.get("error"):
        return {}

    logger.info("agent_node_start", agent=agent_name, investigation_id=inv_id)

    run_tree = None
    if settings.LANGCHAIN_TRACING_V2 == "true":
        try:
            from langsmith import RunTree
            run_tree = RunTree(
                name=f"agent_{agent_name}",
                run_type="chain",
                inputs={k: v for k, v in state.items() if k not in ("log_data", "alert_payload")},
                project_name=settings.LANGCHAIN_PROJECT,
            )
            run_tree.post()
        except Exception as e:
            logger.warning("langsmith_run_tree_init_failed", error=str(e))

    try:
        # Run agent logic (which already wraps itself in appropriate timeouts)
        output_dict = await agent_instance.run(state)
        
        # Determine output key (e.g., alert_summary)
        output_key = list(output_dict.keys())[0]
        raw_val = output_dict[output_key]
        
        # Validate schema
        validated_obj = agent_instance._validate_output(
            raw_val.model_dump() if hasattr(raw_val, "model_dump") else raw_val
        )

        # ── Durable Persistence (Requirement 10.5 & 10.6) ───────────────────
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    # 1. Write AgentOutput record
                    db_output = AgentOutput(
                        investigation_id=inv_id,
                        agent_name=agent_name,
                        output=validated_obj.model_dump(mode="json"),
                    )
                    session.add(db_output)

                    # 2. Update Investigation status/stage
                    stmt = select(Investigation).where(Investigation.id == inv_id)
                    res = await session.execute(stmt)
                    investigation = res.scalar_one_or_none()

                    if investigation:
                        investigation.stage = db_stage_after
                        investigation.status = InvestigationStatus.running

                        # Custom handling for Postmortem completion
                        if agent_name == "postmortem_agent":
                            investigation.status = InvestigationStatus.completed
                            investigation.stage = WorkflowStage.closed

                            # Create the Postmortem entry
                            db_pm = Postmortem(
                                id=inv_id,
                                sections=validated_obj.model_dump(mode="json").get("sections", []),
                                status=PostmortemStatus.ready,
                            )
                            session.add(db_pm)

            if run_tree:
                try:
                    run_tree.end(outputs=output_dict)
                    run_tree.post()
                except Exception:
                    pass
            logger.info("agent_node_success", agent=agent_name, investigation_id=inv_id)
            return output_dict

        except Exception as db_exc:
            if run_tree:
                try:
                    run_tree.end(error=str(db_exc))
                    run_tree.post()
                except Exception:
                    pass
            # Storage failure: Requirement 10.6
            logger.error("durable_storage_failed", agent=agent_name, error=str(db_exc))
            # Try to mark the investigation as failed due to storage issues
            try:
                async with AsyncSessionLocal() as session:
                    async with session.begin():
                        stmt = select(Investigation).where(Investigation.id == inv_id)
                        res = await session.execute(stmt)
                        investigation = res.scalar_one_or_none()
                        if investigation:
                            investigation.status = InvestigationStatus.failed
                            investigation.error = {
                                "agent_name": agent_name,
                                "error_type": "StorageError",
                                "message": f"Durable storage failed during agent write: {db_exc}",
                            }
            except Exception:
                pass
            return {
                "error": {
                    "agent_name": agent_name,
                    "error_type": "StorageError",
                    "message": str(db_exc),
                }
            }

    except Exception as exc:
        if run_tree:
            try:
                run_tree.end(error=str(exc))
                run_tree.post()
            except Exception:
                pass
        # Catch and record any failure in the orchestrator pipeline: Requirement 10.2
        logger.error("agent_node_failed", agent=agent_name, error=str(exc))
        
        error_info = {
            "agent_name": agent_name,
            "error_type": exc.__class__.__name__,
            "message": str(exc),
        }

        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    stmt = select(Investigation).where(Investigation.id == inv_id)
                    res = await session.execute(stmt)
                    investigation = res.scalar_one_or_none()
                    if investigation:
                        investigation.status = InvestigationStatus.failed
                        investigation.error = error_info
                        # Set stage to timed_out on RCA timeout (Requirement 6.6)
                        if agent_name == "rca_agent" and isinstance(exc, asyncio.TimeoutError):
                            investigation.stage = "timed_out"

        except Exception as db_exc:
            logger.error("durable_storage_failed_on_error", agent=agent_name, error=str(db_exc))

        return {"error": error_info}


# ── LangGraph Node wrappers ──────────────────────────────────────────────────

async def node_alert_agent(state: InvestigationState) -> dict[str, Any]:
    # AlertAgent finishes triaging phase. Next stage is still triaging.
    return await execute_agent_node(AlertAgent(), state, "triaging")


async def node_log_analysis_agent(state: InvestigationState) -> dict[str, Any]:
    # LogAnalysisAgent finishes. Next stage is still triaging.
    return await execute_agent_node(LogAnalysisAgent(), state, "triaging")


async def node_retrieval_agent(state: InvestigationState) -> dict[str, Any]:
    # RetrievalAgent finishes. Transitions to Root Cause Analysis stage.
    return await execute_agent_node(RetrievalAgent(), state, "root_cause_analysis")


async def node_rca_agent(state: InvestigationState) -> dict[str, Any]:
    # RCAAgent finishes. Transitions to Remediation stage.
    return await execute_agent_node(RCAAgent(), state, "remediation")


async def node_remediation_agent(state: InvestigationState) -> dict[str, Any]:
    # RemediationAgent finishes. Transitions to Verification stage.
    return await execute_agent_node(RemediationAgent(), state, "verification")


async def node_postmortem_agent(state: InvestigationState) -> dict[str, Any]:
    # PostmortemAgent finishes. Transitions to Closed.
    return await execute_agent_node(PostmortemAgent(), state, "closed")


async def node_error_handler(state: InvestigationState) -> dict[str, Any]:
    """Node executed when an error occurred in the pipeline."""
    # The failing node has already set status=failed in the database.
    # This node just logs it and terminates the LangGraph execution.
    logger.error("orchestrator_error_handler_triggered", error=state.get("error"))
    return {}


# ── Routing functions ────────────────────────────────────────────────────────

def route_after_alert(state: InvestigationState) -> str:
    if state.get("error"):
        return "error_handler"
    return "log_analysis_agent"


def route_after_log_analysis(state: InvestigationState) -> str:
    if state.get("error"):
        return "error_handler"
    return "retrieval_agent"


def route_after_retrieval(state: InvestigationState) -> str:
    if state.get("error"):
        return "error_handler"
    return "rca_agent"


def route_after_rca(state: InvestigationState) -> str:
    if state.get("error"):
        return "error_handler"
    return "remediation_agent"


def route_after_reremediation(state: InvestigationState) -> str:
    if state.get("error"):
        return "error_handler"
    return "postmortem_agent"


# ── Graph Definition ─────────────────────────────────────────────────────────

workflow = StateGraph(InvestigationState)

# Add Nodes
workflow.add_node("alert_agent", node_alert_agent)
workflow.add_node("log_analysis_agent", node_log_analysis_agent)
workflow.add_node("retrieval_agent", node_retrieval_agent)
workflow.add_node("rca_agent", node_rca_agent)
workflow.add_node("remediation_agent", node_remediation_agent)
workflow.add_node("postmortem_agent", node_postmortem_agent)
workflow.add_node("error_handler", node_error_handler)

# Set Entry Point
workflow.set_entry_point("alert_agent")

# Add Conditional Edges
workflow.add_conditional_edges(
    "alert_agent",
    route_after_alert,
    {"log_analysis_agent": "log_analysis_agent", "error_handler": "error_handler"},
)
workflow.add_conditional_edges(
    "log_analysis_agent",
    route_after_log_analysis,
    {"retrieval_agent": "retrieval_agent", "error_handler": "error_handler"},
)
workflow.add_conditional_edges(
    "retrieval_agent",
    route_after_retrieval,
    {"rca_agent": "rca_agent", "error_handler": "error_handler"},
)
workflow.add_conditional_edges(
    "rca_agent",
    route_after_rca,
    {"remediation_agent": "remediation_agent", "error_handler": "error_handler"},
)
workflow.add_conditional_edges(
    "remediation_agent",
    route_after_reremediation,
    {"postmortem_agent": "postmortem_agent", "error_handler": "error_handler"},
)

# Postmortem agent always transitions to either END or error_handler
workflow.add_conditional_edges(
    "postmortem_agent",
    lambda state: "error_handler" if state.get("error") else END,
    {"error_handler": "error_handler", END: END},
)

# Error handler transitions to END
workflow.add_edge("error_handler", END)

# Compile Graph
app_graph = workflow.compile()
