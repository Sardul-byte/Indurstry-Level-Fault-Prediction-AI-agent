"""
Root Cause Analysis (RCA) Agent implementation.

Synthesizes alert summaries, log summaries, and retrieved knowledge context
to produce up to 5 root cause hypotheses, sorted by confidence score descending,
with cited evidence. Enforces timeout, invalid input, and low confidence fallbacks.
"""

from __future__ import annotations

import asyncio
from typing import Any

from pydantic import BaseModel

from app.agents.base import AgentBase
from app.llm.provider import LLMProvider
from app.schemas.agent_outputs import RCAResult, RootCauseHypothesis


class RCAAgent(AgentBase):
    """Agent responsible for running Root Cause Analysis based on alert, log, and RAG context."""

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Execute root cause analysis step.

        Args:
            state: InvestigationState dict.

        Returns:
            Dict containing the 'rca_result' key.
        """
        alert_summary = state.get("alert_summary")
        log_summary = state.get("log_summary")
        retrieval_context = state.get("retrieval_context")

        # Validate alert_summary and log_summary inputs (Requirement 6.7)
        alert_fields = ["alert_type", "severity", "impacted_services", "classification_status"]
        log_fields = ["anomalies", "error_groups", "failure_patterns", "analysis_status"]

        if not self._is_valid_input(alert_summary, alert_fields) or not self._is_valid_input(log_summary, log_fields):
            return {
                "rca_result": RCAResult(
                    hypotheses=[],
                    analysis_status="invalid_input",
                )
            }

        try:
            # Must complete within 60 seconds (Requirement 6.5)
            # Timeout is propagated to orchestrator so stage can be marked timed_out (Requirement 6.6)
            result = await asyncio.wait_for(
                self._run_logic(alert_summary, log_summary, retrieval_context),
                timeout=60.0,
            )
            return result
        except asyncio.TimeoutError:
            # Re-raise so orchestrator catches it to transition to timed_out / failed state
            raise

    def _is_valid_input(self, val: Any, required_fields: list[str]) -> bool:
        """Helper to validate that input has the required fields, whether dict or object."""
        if val is None:
            return False
        if isinstance(val, dict):
            return all(f in val for f in required_fields)
        return all(hasattr(val, f) for f in required_fields)

    async def _run_logic(
        self,
        alert_summary: Any,
        log_summary: Any,
        retrieval_context: Any,
    ) -> dict[str, Any]:
        try:
            # Format retrieval context excerpts
            context_excerpts = []
            if retrieval_context:
                if isinstance(retrieval_context, dict):
                    excerpts = retrieval_context.get("excerpts") or []
                else:
                    excerpts = getattr(retrieval_context, "excerpts", []) or []

                for exc in excerpts:
                    if isinstance(exc, dict):
                        doc_name = exc.get("document_name") or ""
                        section = exc.get("section") or ""
                        content = exc.get("content") or ""
                    else:
                        doc_name = getattr(exc, "document_name", "") or ""
                        section = getattr(exc, "section", "") or ""
                        content = getattr(exc, "content", "") or ""
                    context_excerpts.append(
                        f"- Runbook: {doc_name} (Section: {section})\n  Content: {content}"
                    )

            context_str = "\n".join(context_excerpts) if context_excerpts else "No relevant context found."

            system_instruction = (
                "You are an SRE Root Cause Analysis (RCA) expert. Analyze the given alert summary, log summary, "
                "and retrieved runbook context. Generate a ranked list of up to 5 root cause hypotheses. "
                "Each hypothesis must contain:\n"
                "- hypothesis: description of the proposed root cause\n"
                "- confidence_score: float value in range [0.0, 1.0]\n"
                "- evidence: list of alert fields, log lines, or document sections supporting this (min 1 item)\n\n"
                "Rules:\n"
                "1. Sort hypotheses by confidence_score descending.\n"
                "2. If no hypothesis has a confidence_score >= 0.2, set analysis_status to 'low_confidence' but still include the highest scoring hypothesis.\n"
                "3. If hypotheses are found, set analysis_status to 'ok'.\n"
            )

            # Build prompt using JSON dumps if inputs are models
            alert_json = alert_summary.model_dump_json() if hasattr(alert_summary, "model_dump_json") else str(alert_summary)
            log_json = log_summary.model_dump_json() if hasattr(log_summary, "model_dump_json") else str(log_summary)

            user_prompt = (
                f"Alert Summary:\n{alert_json}\n\n"
                f"Log Summary:\n{log_json}\n\n"
                f"Retrieved Runbook Excerpts:\n{context_str}"
            )

            llm = LLMProvider.get()
            structured_llm = llm.with_structured_output(RCAResult)
            result = await structured_llm.ainvoke(
                f"{system_instruction}\n\n{user_prompt}"
            )

            # Post-process to guarantee all constraints
            if len(result.hypotheses) > 5:
                result.hypotheses = result.hypotheses[:5]

            # Ensure confidence scores are in [0, 1] and each has evidence
            for h in result.hypotheses:
                h.confidence_score = max(0.0, min(1.0, h.confidence_score))
                if not h.evidence:
                    h.evidence = ["Correlated logs and alert payload indications."]

            # Sort descending by confidence_score
            result.hypotheses.sort(key=lambda h: h.confidence_score, reverse=True)

            # Enforce low confidence check
            if result.hypotheses:
                max_score = result.hypotheses[0].confidence_score
                if max_score < 0.2:
                    result.analysis_status = "low_confidence"
            else:
                result.analysis_status = "low_confidence"
                result.hypotheses = [
                    RootCauseHypothesis(
                        hypothesis="Unknown issue — insufficient evidence.",
                        confidence_score=0.1,
                        evidence=["Incident data did not correlate with any known failures."],
                    )
                ]

            return {"rca_result": result}

        except Exception:
            # Return low_confidence fallback if LLM or parsing errors out
            return {
                "rca_result": RCAResult(
                    hypotheses=[
                        RootCauseHypothesis(
                            hypothesis="Unknown issue — analysis parse error.",
                            confidence_score=0.1,
                            evidence=["Failed to run root cause analysis model parsing."],
                        )
                    ],
                    analysis_status="low_confidence",
                )
            }

    def output_schema(self) -> type[BaseModel]:
        return RCAResult
