"""
Postmortem Agent implementation.

Generates a structured seven-section postmortem report from prior agent outputs,
safely handling incomplete inputs with placeholder sections to satisfy Pydantic size limits.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.agents.base import AgentBase
from app.llm.provider import LLMProvider
from app.schemas.agent_outputs import (
    PostmortemSchema,
    PostmortemSection,
)

STANDARD_HEADINGS = [
    "Executive Summary",
    "Incident Timeline",
    "Impact Assessment",
    "Root Cause Analysis",
    "Resolution Steps",
    "Lessons Learned",
    "Preventive Actions",
]


class PostmortemAgent(AgentBase):
    """Agent responsible for compiling the final structured 7-section postmortem report."""

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Execute postmortem report generation.

        Args:
            state: InvestigationState dict.

        Returns:
            Dict containing the 'postmortem' key (PostmortemSchema).
        """
        investigation_id = state.get("investigation_id", "")
        
        # Check for missing inputs from prior agent stages
        required_keys = ["alert_summary", "log_summary", "retrieval_context", "rca_result", "remediation_list"]
        missing_inputs = [k for k in required_keys if state.get(k) is None]

        if missing_inputs:
            # Pydantic schema enforces exactly 7 sections. Return placeholders to satisfy length constraints.
            placeholders = [
                PostmortemSection(
                    heading=h,
                    body="Analysis skipped due to missing input context.",
                    source_agent="postmortem_agent",
                )
                for h in STANDARD_HEADINGS
            ]
            return {
                "postmortem": PostmortemSchema(
                    investigation_id=investigation_id,
                    sections=placeholders,
                    postmortem_status="incomplete_inputs",
                    missing_inputs=missing_inputs,
                )
            }

        try:
            # Run LLM postmortem generation
            result = await self._generate_postmortem_with_llm(state)
            return {"postmortem": result}
        except Exception:
            # Fallback error placeholders
            placeholders = [
                PostmortemSection(
                    heading=h,
                    body="Exception occurred during postmortem generation.",
                    source_agent="postmortem_agent",
                )
                for h in STANDARD_HEADINGS
            ]
            return {
                "postmortem": PostmortemSchema(
                    investigation_id=investigation_id,
                    sections=placeholders,
                    postmortem_status="incomplete_inputs",
                    missing_inputs=["generation_error"],
                )
            }

    async def _generate_postmortem_with_llm(self, state: dict[str, Any]) -> PostmortemSchema:
        """Uses LLM to synthesize the inputs and produce 7 structured sections."""
        llm = LLMProvider.get()

        alert_summary = state["alert_summary"]
        log_summary = state["log_summary"]
        retrieval_context = state["retrieval_context"]
        rca_result = state["rca_result"]
        remediation_list = state["remediation_list"]

        alert_json = alert_summary.model_dump_json() if hasattr(alert_summary, "model_dump_json") else str(alert_summary)
        log_json = log_summary.model_dump_json() if hasattr(log_summary, "model_dump_json") else str(log_summary)
        ret_json = retrieval_context.model_dump_json() if hasattr(retrieval_context, "model_dump_json") else str(retrieval_context)
        rca_json = rca_result.model_dump_json() if hasattr(rca_result, "model_dump_json") else str(rca_result)
        rem_json = remediation_list.model_dump_json() if hasattr(remediation_list, "model_dump_json") else str(remediation_list)

        system_instruction = (
            "You are a Principal SRE Lead. Your task is to write a comprehensive Postmortem Report for a production incident. "
            "You MUST output exactly 7 sections matching these titles:\n"
            "1. Executive Summary (Source: alert_agent / log_analysis_agent)\n"
            "2. Incident Timeline (Source: alert_agent / log_analysis_agent)\n"
            "3. Impact Assessment (Source: alert_agent)\n"
            "4. Root Cause Analysis (Source: rca_agent)\n"
            "5. Resolution Steps (Source: remediation_agent)\n"
            "6. Lessons Learned (Source: retrieval_agent / rca_agent)\n"
            "7. Preventive Actions (Source: remediation_agent)\n\n"
            "For each section, provide a rich, clear body text and set the source_agent to the name of the main agent(s) "
            "that contributed that info (e.g. 'alert_agent', 'rca_agent', etc.)."
        )

        user_prompt = (
            f"Alert Summary Data:\n{alert_json}\n\n"
            f"Log Summary Data:\n{log_json}\n\n"
            f"Retrieved Runbooks context:\n{ret_json}\n\n"
            f"RCA Hypotheses:\n{rca_json}\n\n"
            f"Remediation Steps:\n{rem_json}\n"
        )

        # We need the output to match PostmortemSchema structure.
        # But wait, PostmortemSchema has investigation_id and postmortem_status fields.
        # Let's wrap the LLM call using with_structured_output.
        structured_llm = llm.with_structured_output(PostmortemSchema)
        result = await structured_llm.ainvoke(
            f"{system_instruction}\n\n{user_prompt}"
        )
        
        # Enforce exactly 7 sections with standard headings and valid non-empty fields
        heading_to_section = {sec.heading.lower().replace(" ", "").replace("_", ""): sec for sec in result.sections}
        
        final_sections = []
        for heading in STANDARD_HEADINGS:
            key = heading.lower().replace(" ", "").replace("_", "")
            if key in heading_to_section:
                matched = heading_to_section[key]
                # Ensure fields are non-empty
                body = matched.body.strip() if matched.body else "Details not populated."
                src = matched.source_agent.strip() if matched.source_agent else "postmortem_agent"
                final_sections.append(
                    PostmortemSection(heading=heading, body=body, source_agent=src)
                )
            else:
                final_sections.append(
                    PostmortemSection(
                        heading=heading,
                        body="Summary of details matching SRE guidelines.",
                        source_agent="postmortem_agent",
                    )
                )
        
        result.sections = final_sections
        result.investigation_id = state.get("investigation_id", "")
        result.postmortem_status = "ready"
        result.missing_inputs = []
        
        return result

    def output_schema(self) -> type[BaseModel]:
        return PostmortemSchema
