"""
FastAPI route handlers for incident postmortem report retrieval.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.models.investigation import Investigation, InvestigationStatus
from app.models.postmortem import Postmortem, PostmortemStatus
from app.schemas.agent_outputs import PostmortemSection
from app.schemas.responses import ReportResponse

logger = get_logger(__name__)
router = APIRouter(tags=["reports"])


def is_valid_uuid(val: str) -> bool:
    """Validate if a string conforms to UUIDv4 format."""
    try:
        uuid.UUID(val, version=4)
        return True
    except ValueError:
        return False


def build_markdown_report(investigation_id: str, sections: list[Any]) -> str:
    """Builds a formatted Markdown document from the 7 postmortem sections."""
    lines = [
        f"# AI Incident Postmortem Report",
        f"**Investigation ID:** `{investigation_id}`",
        f"**Generated At:** {uuid.uuid4()}\n",
        "---",
        "",
    ]
    for sec in sections:
        heading = sec.get("heading") if isinstance(sec, dict) else getattr(sec, "heading", "")
        body = sec.get("body") if isinstance(sec, dict) else getattr(sec, "body", "")
        src = sec.get("source_agent") if isinstance(sec, dict) else getattr(sec, "source_agent", "")

        lines.extend([
            f"## {heading}",
            body,
            "",
            f"> *Source Attribution: {src}*",
            "",
            "---",
            "",
        ])
    return "\n".join(lines)


@router.get(
    "/report/{id}",
    response_model=ReportResponse,
    summary="Get the generated postmortem report",
)
async def get_report(
    id: str,
    format: str | None = Query(None, description="Set 'markdown' to download a Markdown file"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve the incident postmortem report.

    If the postmortem is not yet ready, returns HTTP 202 with status='pending'.
    If the parameter format=markdown is supplied, serves a Markdown file download.
    """
    if not is_valid_uuid(id):
        raise HTTPException(
            status_code=400,
            detail="Malformed investigation ID format. Must be a valid UUIDv4.",
        )

    # 1. Look up parent investigation to check existency
    stmt = select(Investigation).where(Investigation.id == id)
    res = await db.execute(stmt)
    investigation = res.scalar_one_or_none()

    if not investigation:
        raise HTTPException(
            status_code=404,
            detail=f"Investigation with ID '{id}' not found.",
        )

    # 2. Query Postmortem record
    pm_stmt = select(Postmortem).where(Postmortem.id == id)
    pm_res = await db.execute(pm_stmt)
    postmortem = pm_res.scalar_one_or_none()

    # 3. Handle pending states
    if not postmortem:
        if investigation.status == InvestigationStatus.failed:
            # Investigation failed, return incomplete state
            return ReportResponse(
                investigation_id=id,
                postmortem_status=PostmortemStatus.incomplete_inputs.value,
                sections=None,
            )
        else:
            # Still pending or running
            return Response(
                status_code=202,
                content=ReportResponse(
                    investigation_id=id,
                    postmortem_status=PostmortemStatus.pending.value,
                    sections=None,
                ).model_dump_json(),
                media_type="application/json",
            )

    # Convert database sections list to Pydantic objects
    db_sections = postmortem.sections
    pydantic_sections = [
        PostmortemSection(
            heading=sec.get("heading", ""),
            body=sec.get("body", ""),
            source_agent=sec.get("source_agent", ""),
        )
        for sec in db_sections
    ]

    # 4. Return as Markdown file download if requested (Requirement 8.5)
    if format == "markdown":
        md_content = build_markdown_report(id, db_sections)
        headers = {
            "Content-Disposition": f'attachment; filename="postmortem-{id}.md"'
        }
        return Response(
            content=md_content,
            media_type="text/markdown",
            headers=headers,
        )

    return ReportResponse(
        investigation_id=id,
        postmortem_status=postmortem.status.value,
        sections=pydantic_sections,
    )
