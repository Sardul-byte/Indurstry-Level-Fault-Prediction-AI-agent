"""
Remediation Agent implementation.

Generates up to 10 remediation steps, links them to root cause hypotheses,
enforces confidence labels (supported/speculative) and default rationales,
and sorts them deterministically (confidence desc, category order: operational > config > code).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.agents.base import AgentBase
from app.llm.provider import LLMProvider
from app.schemas.agent_outputs import (
    RCAResult,
    RemediationList,
    RemediationStep,
)


class RawRemediationStep(BaseModel):
    """Temporary helper model for LLM generation with target hypothesis mapping."""
    action: str
    category: str  # operational, configuration, code_change
    rationale: str
    target_hypothesis: str  # Text description of the hypothesis this step addresses


class RawRemediationStepList(BaseModel):
    """Temporary list helper model for LLM generation."""
    steps: list[RawRemediationStep]


class RemediationAgent(AgentBase):
    """Agent responsible for recommending operational, configuration, or code remediation steps."""

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Execute remediation recommendation.

        Args:
            state: InvestigationState dict.

        Returns:
            Dict containing the 'remediation_list' key.
        """
        rca_result = state.get("rca_result")

        # Fallback if no RCA result
        if not rca_result:
            return {
                "remediation_list": RemediationList(steps=[])
            }

        try:
            # 1. Ask LLM to generate recommendations mapped to target hypotheses
            raw_steps = await self._generate_remediations_with_llm(rca_result)

            # 2. Map, label, and sort steps in Python
            processed_steps: list[tuple[RemediationStep, float, int]] = []
            hypotheses = getattr(rca_result, "hypotheses", []) or rca_result.get("hypotheses", [])

            for step in raw_steps:
                # Find matching hypothesis
                matched_hyp = None
                best_score = -1.0
                
                target_lower = step.target_hypothesis.lower()
                for hyp in hypotheses:
                    hyp_text = getattr(hyp, "hypothesis", "") or hyp.get("hypothesis", "")
                    hyp_score = getattr(hyp, "confidence_score", 0.0) or hyp.get("confidence_score", 0.0)
                    
                    # Fuzzy match: check if target text matches hypothesis text
                    if hyp_text.lower() in target_lower or target_lower in hyp_text.lower():
                        matched_hyp = hyp
                        best_score = hyp_score
                        break

                # If no direct match, check if target contains substring or just pick the best score
                if not matched_hyp and len(hypotheses) == 1:
                    matched_hyp = hypotheses[0]
                    best_score = getattr(hypotheses[0], "confidence_score", 0.0) or hypotheses[0].get("confidence_score", 0.0)

                # Set confidence label
                confidence_label: Literal["supported", "speculative"] = "speculative"
                parent_score = 0.0
                if matched_hyp:
                    parent_score = best_score
                    if parent_score >= 0.4:
                        confidence_label = "supported"
                else:
                    confidence_label = "speculative"

                # Set rationale
                rationale_str = step.rationale.strip()
                if not matched_hyp or not rationale_str:
                    rationale_str = "no_hypothesis_available"

                # Standardize category
                cat = step.category.lower().strip()
                if cat not in ["operational", "configuration", "code_change"]:
                    cat = "operational"

                # Define category sorting rank
                # operational (1) -> configuration (2) -> code_change (3)
                cat_rank = 1
                if cat == "configuration":
                    cat_rank = 2
                elif cat == "code_change":
                    cat_rank = 3

                remediation_step = RemediationStep(
                    action=step.action,
                    category=cat,  # type: ignore
                    rationale=rationale_str,
                    confidence=confidence_label,
                )
                processed_steps.append((remediation_step, parent_score, cat_rank))

            # 3. Sort prioritized steps:
            # - Primary: parent hypothesis confidence_score descending (-parent_score)
            # - Secondary: category order ascending (cat_rank)
            processed_steps.sort(key=lambda x: (-x[1], x[2]))

            # 4. Limit to 10 steps
            final_steps = [item[0] for item in processed_steps[:10]]

            return {
                "remediation_list": RemediationList(steps=final_steps)
            }

        except Exception:
            return {
                "remediation_list": RemediationList(steps=[])
            }

    async def _generate_remediations_with_llm(self, rca_result: Any) -> list[RawRemediationStep]:
        """Uses LLM to recommend remediation steps targeting the root cause hypotheses."""
        llm = LLMProvider.get()

        hypotheses = getattr(rca_result, "hypotheses", []) or rca_result.get("hypotheses", [])
        hyp_list_str = []
        for i, hyp in enumerate(hypotheses):
            hyp_text = getattr(hyp, "hypothesis", "") or hyp.get("hypothesis", "")
            hyp_score = getattr(hyp, "confidence_score", 0.0) or hyp.get("confidence_score", 0.0)
            hyp_list_str.append(f"Hypothesis {i+1}: {hyp_text} (Confidence: {hyp_score})")

        system_instruction = (
            "You are an incident remediation expert. Based on the root cause hypotheses, "
            "generate up to 10 specific remediation actions. For each action, specify:\n"
            "- action: The concrete task to execute (e.g. restart service, patch DB connection pool).\n"
            "- category: Must be exactly one of 'operational', 'configuration', or 'code_change'.\n"
            "- rationale: The reason why this action mitigates the incident, referencing the hypothesis.\n"
            "- target_hypothesis: The exact text description of the Hypothesis this step addresses.\n\n"
            "If a remediation action is general and does not map to any specific hypothesis, set target_hypothesis to 'None'."
        )

        user_prompt = f"Root Cause Hypotheses:\n" + "\n".join(hyp_list_str)

        try:
            structured_llm = llm.with_structured_output(RawRemediationStepList)
            result = await structured_llm.ainvoke(
                f"{system_instruction}\n\n{user_prompt}"
            )
            return result.steps
        except Exception:
            # Fallback remediation if LLM fails
            steps = []
            for hyp in hypotheses:
                hyp_text = getattr(hyp, "hypothesis", "") or hyp.get("hypothesis", "")
                steps.append(
                    RawRemediationStep(
                        action=f"Investigate logs and runbooks regarding: {hyp_text}.",
                        category="operational",
                        rationale=f"RCA identified hypothesis: {hyp_text}",
                        target_hypothesis=hyp_text,
                    )
                )
            return steps

    def output_schema(self) -> type[BaseModel]:
        return RemediationList
