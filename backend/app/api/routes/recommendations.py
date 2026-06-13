"""
FastAPI route handlers for incident remediation recommendations retrieval.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.models.agent_output import AgentOutput
from app.models.investigation import Investigation, InvestigationStatus
from app.schemas.agent_outputs import RemediationStep
from app.schemas.responses import RecommendationsResponse

logger = get_logger(__name__)
router = APIRouter(tags=["recommendations"])


def is_valid_uuid(val: str) -> bool:
    """Validate if a string conforms to UUIDv4 format."""
    try:
        uuid.UUID(val, version=4)
        return True
    except ValueError:
        return False


@router.get(
    "/recommendations/{id}",
    response_model=RecommendationsResponse,
    summary="Get remediation recommendations for an incident",
)
async def get_recommendations(
    id: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve the prioritized list of remediation recommendations.

    If the investigation is failed, returns HTTP 422.
    If the recommendations are not yet ready, returns HTTP 202 with status='pending'.
    """
    if not is_valid_uuid(id):
        raise HTTPException(
            status_code=400,
            detail="Malformed investigation ID format. Must be a valid UUIDv4.",
        )

    # 1. Fetch Investigation record to verify existence
    stmt = select(Investigation).where(Investigation.id == id)
    res = await db.execute(stmt)
    investigation = res.scalar_one_or_none()

    if not investigation:
        raise HTTPException(
            status_code=404,
            detail=f"Investigation with ID '{id}' not found.",
        )

    # 2. Check for failure states (Requirement 9.4)
    if investigation.status == InvestigationStatus.failed:
        raise HTTPException(
            status_code=422,
            detail=RecommendationsResponse(
                investigation_id=id,
                recommendations_status="failed",
                steps=None,
            ).model_dump(),
        )

    # 3. Retrieve Remediation list from Agent Outputs
    op_stmt = (
        select(AgentOutput)
        .where(
            AgentOutput.investigation_id == id,
            AgentOutput.agent_name == "remediation_agent",
        )
        .limit(1)
    )
    op_res = await db.execute(op_stmt)
    agent_output = op_res.scalar_one_or_none()

    # 4. Handle pending state (Requirement 9.2)
    if not agent_output:
        return Response(
            status_code=202,
            content=RecommendationsResponse(
                investigation_id=id,
                recommendations_status="pending",
                steps=None,
            ).model_dump_json(),
            media_type="application/json",
        )

    # Decode step list
    steps_data = agent_output.output.get("steps", [])
    steps = [
        RemediationStep(
            action=s.get("action", ""),
            category=s.get("category", "operational"),
            rationale=s.get("rationale", ""),
            confidence=s.get("confidence", "speculative"),
        )
        for s in steps_data
    ]

    return RecommendationsResponse(
        investigation_id=id,
        recommendations_status="completed",
        steps=steps,
    )
