"""
Alert Agent implementation.

Parses alert payloads, classifies severity, type, and impacted services,
and ensures fallback properties are strictly satisfied.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel

from app.agents.base import AgentBase
from app.llm.provider import LLMProvider
from app.schemas.agent_outputs import AlertSummary


class AlertAgent(AgentBase):
    """Agent responsible for parsing alerts, classifying severity, and mapping impacted services."""

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Execute alert parsing and classification.

        Args:
            state: InvestigationState dict.

        Returns:
            Dict containing the 'alert_summary' key.
        """
        alert_payload = state.get("alert_payload")
        
        # Check for missing/malformed payload
        if not alert_payload or not isinstance(alert_payload, dict):
            return {
                "alert_summary": AlertSummary(
                    alert_type="custom",
                    severity="low",
                    impacted_services=[],
                    alert_timestamp=datetime.now(timezone.utc),
                    classification_status="parse_error",
                )
            }

        try:
            # Must complete within 10 seconds (Requirement 3.5)
            result = await asyncio.wait_for(self._run_logic(alert_payload), timeout=10.0)
            return result
        except Exception:
            # Fallback on timeout or other error
            return {
                "alert_summary": AlertSummary(
                    alert_type="custom",
                    severity="low",
                    impacted_services=[],
                    alert_timestamp=datetime.now(timezone.utc),
                    classification_status="parse_error",
                )
            }

    async def _run_logic(self, alert_payload: dict[str, Any]) -> dict[str, Any]:
        llm = LLMProvider.get()
        
        system_instruction = (
            "You are a production incident triaging system. Your task is to parse a raw alert payload "
            "and extract structured metadata. You MUST return a JSON matching the following schema rules:\n"
            "- alert_type: Must be one of 'availability', 'performance', 'error_rate', 'resource', 'security', 'custom'.\n"
            "- severity: Must be one of 'critical', 'high', 'medium', 'low'.\n"
            "- impacted_services: List of service names (strings) impacted by this alert, capped at a maximum of 20 services.\n"
            "- alert_timestamp: ISO 8601 string of the alert timestamp. If not found in the payload, use the current timestamp.\n"
            "- classification_status: Must be 'classified', 'unclassified', or 'parse_error'.\n\n"
            "Rules for classification:\n"
            "1. If the payload has no recognizable alert type or impacted service, set classification_status to 'unclassified', severity to 'low', and alert_type to 'custom'.\n"
            "2. If the severity is not critical, high, medium, or low, set severity to 'low'.\n"
            "3. If the payload is completely malformed or cannot be understood, set classification_status to 'parse_error', severity to 'low', and alert_type to 'custom'.\n"
        )
        
        user_prompt = f"Raw Alert Payload:\n{alert_payload}"
        
        try:
            # Attempt structured output extraction using LangChain
            structured_llm = llm.with_structured_output(AlertSummary)
            summary = await structured_llm.ainvoke(
                f"{system_instruction}\n\n{user_prompt}"
            )
            # Enforce max 20 impacted services
            if summary.impacted_services and len(summary.impacted_services) > 20:
                summary.impacted_services = summary.impacted_services[:20]
            
            # Post-validate enums in case model bypassed them
            if summary.alert_type not in ["availability", "performance", "error_rate", "resource", "security", "custom"]:
                summary.alert_type = "custom"
            if summary.severity not in ["critical", "high", "medium", "low"]:
                summary.severity = "low"
            if summary.classification_status not in ["classified", "unclassified", "parse_error"]:
                summary.classification_status = "unclassified"
                
            return {"alert_summary": summary}
        except Exception:
            # Fallback output
            return {
                "alert_summary": AlertSummary(
                    alert_type="custom",
                    severity="low",
                    impacted_services=[],
                    alert_timestamp=datetime.now(timezone.utc),
                    classification_status="parse_error",
                )
            }

    def output_schema(self) -> type[BaseModel]:
        return AlertSummary
