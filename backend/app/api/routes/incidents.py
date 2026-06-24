"""
FastAPI route handlers for incident submission and status retrieval.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.logging import get_logger
from app.models.agent_output import AgentOutput
from app.models.investigation import Investigation, InvestigationStatus, WorkflowStage
from app.orchestrator.graph import app_graph
from app.schemas.incident import (
    AgentOutputSummary,
    IncidentCreateResponse,
    IncidentPayload,
    InvestigationStatusResponse,
)

logger = get_logger(__name__)
router = APIRouter(tags=["incidents"])


def is_valid_uuid(val: str) -> bool:
    """Helper to validate if a string conforms to UUIDv4 format."""
    try:
        uuid.UUID(val, version=4)
        return True
    except ValueError:
        return False


async def run_investigation_workflow(
    investigation_id: str,
    request_id: str,
    alert_payload: dict[str, Any],
    log_data: str,
    metadata: dict[str, Any],
) -> None:
    """Background task function to execute the LangGraph pipeline."""
    initial_state: dict[str, Any] = {
        "investigation_id": investigation_id,
        "request_id": request_id,
        "alert_payload": alert_payload,
        "log_data": log_data,
        "metadata": metadata,
        "alert_summary": None,
        "log_summary": None,
        "retrieval_context": None,
        "rca_result": None,
        "remediation_list": None,
        "postmortem": None,
        "current_stage": "triaging",
        "error": None,
    }

    logger.info("background_workflow_trigger", investigation_id=investigation_id, request_id=request_id)
    
    try:
        await app_graph.ainvoke(initial_state)
        logger.info("background_workflow_complete", investigation_id=investigation_id)
    except Exception as exc:
        logger.exception("background_workflow_unhandled_failure", investigation_id=investigation_id, error=str(exc))
        
        # Enforce fail status in case exception bypassed internal LangGraph wrappers
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    stmt = select(Investigation).where(Investigation.id == investigation_id)
                    res = await session.execute(stmt)
                    investigation = res.scalar_one_or_none()
                    if investigation and investigation.status != InvestigationStatus.completed:
                        investigation.status = InvestigationStatus.failed
                        investigation.error = {
                            "agent_name": "orchestrator",
                            "error_type": exc.__class__.__name__,
                            "message": f"Orchestrator unhandled workflow crash: {exc}",
                        }
        except Exception as db_exc:
            logger.error("background_workflow_db_update_failed", error=str(db_exc))
    finally:
        # Trigger RAGAS evaluation on terminal state (completed/failed)
        try:
            from app.evaluation.ragas_evaluator import evaluate_investigation
            await evaluate_investigation(investigation_id)
        except Exception as eval_exc:
            logger.error("ragas_evaluation_trigger_failed", investigation_id=investigation_id, error=str(eval_exc))


@router.post(
    "/incident",
    response_model=IncidentCreateResponse,
    status_code=202,
    summary="Submit a new incident for investigation",
)
async def submit_incident(
    payload: IncidentPayload,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> IncidentCreateResponse:
    """Submit a production incident to kick off an autonomous investigation.

    Validates schema payload constraints and returns HTTP 202 Accepted.
    Executes the multi-agent investigation asynchronously.
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    investigation_id = str(uuid.uuid4())

    logger.info("incident_submitted", investigation_id=investigation_id, request_id=request_id)

    # 1. Create durable database record (status = pending)
    meta = {
        "service_name": payload.service_name,
        "environment": payload.environment,
        "timestamp": payload.timestamp.isoformat() if payload.timestamp else None,
    }

    db_investigation = Investigation(
        id=investigation_id,
        status=InvestigationStatus.pending,
        stage=WorkflowStage.triaging,
        alert_payload=payload.alert_data,
        log_data=payload.logs,
        metadata_=meta,
        request_id=request_id,
    )

    db.add(db_investigation)
    await db.flush() # Ensure investigation record exists before background task starts querying it

    # 2. Enqueue background runner asynchronously
    background_tasks.add_task(
        run_investigation_workflow,
        investigation_id=investigation_id,
        request_id=request_id,
        alert_payload=payload.alert_data,
        log_data=payload.logs,
        metadata=meta,
    )

    return IncidentCreateResponse(
        investigation_id=investigation_id,
        status="pending",
    )


@router.get(
    "/incident/{id}",
    response_model=InvestigationStatusResponse,
    summary="Retrieve investigation execution status",
)
async def get_investigation_status(
    id: str,
    db: AsyncSession = Depends(get_db),
) -> InvestigationStatusResponse:
    """Gets status, active stage, and all completed agent outputs for an investigation."""
    if not is_valid_uuid(id):
        raise HTTPException(
            status_code=400,
            detail="Malformed investigation ID format. Must be a valid UUIDv4.",
        )

    # Fetch Investigation record
    stmt = select(Investigation).where(Investigation.id == id)
    res = await db.execute(stmt)
    investigation = res.scalar_one_or_none()

    if not investigation:
        raise HTTPException(
            status_code=404,
            detail=f"Investigation with ID '{id}' not found.",
        )

    # Fetch up to 100 Agent Outputs ordered by completion time
    outputs_stmt = (
        select(AgentOutput)
        .where(AgentOutput.investigation_id == id)
        .order_by(AgentOutput.created_at.asc())
        .limit(100)
    )
    outputs_res = await db.execute(outputs_stmt)
    agent_outputs = outputs_res.scalars().all()

    output_summaries = [
        AgentOutputSummary(
            agent_name=out.agent_name,
            output=out.output,
        )
        for out in agent_outputs
    ]

    return InvestigationStatusResponse(
        investigation_id=investigation.id,
        status=str(investigation.status.value) if hasattr(investigation.status, "value") else str(investigation.status),
        stage=str(investigation.stage.value) if hasattr(investigation.stage, "value") else str(investigation.stage),
        agent_outputs=output_summaries,
    )
