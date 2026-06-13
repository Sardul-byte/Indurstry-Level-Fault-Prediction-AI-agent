"""
Log Analysis Agent implementation.

Parses logs (plain text, JSON, NDJSON), groups errors, detects anomalies,
and identifies recurring failure patterns using a hybrid Python/LLM approach.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel

from app.agents.base import AgentBase
from app.llm.provider import LLMProvider
from app.schemas.agent_outputs import (
    AnomalyEntry,
    ErrorGroup,
    FailurePattern,
    LogSummary,
)


class RawErrorLog(BaseModel):
    """Temporary helper model for LLM parsing of raw logs."""
    error_type: str
    service_name: str
    signature: str


class RawErrorLogList(BaseModel):
    """Temporary list helper model for LLM parsing."""
    errors: list[RawErrorLog]


class LogAnalysisAgent(AgentBase):
    """Agent responsible for log parsing, grouping, and anomaly detection."""

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Execute log analysis.

        Args:
            state: InvestigationState dict.

        Returns:
            Dict containing the 'log_summary' key.
        """
        log_data = state.get("log_data")
        
        # Check for empty logs
        if not log_data or not isinstance(log_data, str) or not log_data.strip():
            return {
                "log_summary": LogSummary(
                    anomalies={},
                    error_groups={},
                    failure_patterns=[],
                    analysis_status="insufficient_data",
                )
            }

        try:
            # 1. Parse JSON/NDJSON if applicable, or fallback to line list
            lines = self._prepare_lines(log_data)
            if not lines:
                return {
                    "log_summary": LogSummary(
                        anomalies={},
                        error_groups={},
                        failure_patterns=[],
                        analysis_status="insufficient_data",
                    )
                }

            # 2. Ask LLM to extract raw errors from lines
            raw_errors = await self._extract_errors_with_llm(lines)
            if not raw_errors:
                return {
                    "log_summary": LogSummary(
                        anomalies={},
                        error_groups={},
                        failure_patterns=[],
                        analysis_status="insufficient_data",
                    )
                }

            # 3. Perform deterministic grouping & counting in Python
            anomalies: dict[str, AnomalyEntry] = {}
            error_groups: dict[str, ErrorGroup] = {}
            pattern_counts: dict[str, int] = {}
            group_counts: dict[str, int] = {}

            # Count occurrences
            for err in raw_errors:
                group_key = f"{err.error_type}::{err.service_name}"
                group_counts[group_key] = group_counts.get(group_key, 0) + 1
                pattern_counts[err.signature] = pattern_counts.get(err.signature, 0) + 1

            # Build error groups and anomalies (threshold > 3)
            for key, count in group_counts.items():
                err_type, service = key.split("::", 1)
                error_groups[key] = ErrorGroup(
                    error_type=err_type,
                    service_name=service,
                    count=count,
                )
                if count > 3:
                    anomalies[key] = AnomalyEntry(
                        error_type=err_type,
                        service_name=service,
                        count=count,
                    )

            # Build failure patterns (threshold >= 3)
            failure_patterns: list[FailurePattern] = []
            for sig, count in pattern_counts.items():
                if count >= 3:
                    failure_patterns.append(
                        FailurePattern(signature=sig, count=count)
                    )

            return {
                "log_summary": LogSummary(
                    anomalies=anomalies,
                    error_groups=error_groups,
                    failure_patterns=failure_patterns,
                    analysis_status="ok",
                )
            }

        except Exception:
            return {
                "log_summary": LogSummary(
                    anomalies={},
                    error_groups={},
                    failure_patterns=[],
                    analysis_status="insufficient_data",
                )
            }

    def _prepare_lines(self, log_data: str) -> list[str]:
        """Normalize log input into lines, extracting content from JSON/NDJSON if needed."""
        # Try JSON parsing of the entire string
        try:
            parsed = json.loads(log_data)
            if isinstance(parsed, list):
                return [json.dumps(item) if isinstance(item, (dict, list)) else str(item) for item in parsed]
            elif isinstance(parsed, dict):
                # If a single JSON dictionary, treat values or keys as lines
                return [json.dumps(parsed)]
        except json.JSONDecodeError:
            pass

        # Split into lines
        lines = [line.strip() for line in log_data.splitlines() if line.strip()]
        return lines

    async def _extract_errors_with_llm(self, lines: list[str]) -> list[RawErrorLog]:
        """Uses LLM to extract individual error events from the normalized log lines."""
        llm = LLMProvider.get()
        
        system_instruction = (
            "You are a log analysis tool. Analyze the log lines provided and extract every single error, warning, or failure entry. "
            "For each log line that represents an error/failure, extract:\n"
            "1. error_type: The name of the exception or error category (e.g., ConnectionTimeout, DatabaseError, AuthFailure).\n"
            "2. service_name: The originating service name if visible in the log line, or 'unknown'.\n"
            "3. signature: The exact error signature or main error message text.\n\n"
            "If a log line does not contain an error or failure, ignore it. Do not group or summarize them — return each raw entry individually."
        )
        
        # Batch lines or pass them directly (ensure we don't hit token limits)
        user_prompt = f"Log lines to analyze:\n" + "\n".join(lines[:100]) # Cap at 100 lines for processing
        
        try:
            structured_llm = llm.with_structured_output(RawErrorLogList)
            parsed_list = await structured_llm.ainvoke(
                f"{system_instruction}\n\n{user_prompt}"
            )
            return parsed_list.errors
        except Exception:
            # Fallback parsing in case of failures: extract simple error patterns deterministically
            errors = []
            for line in lines:
                if any(w in line.upper() for w in ["ERROR", "FAIL", "EXCEPTION", "WARN"]):
                    # Simple heuristic
                    parts = line.split()
                    service = "unknown"
                    for p in parts:
                        if p.startswith("[") and p.endswith("]"):
                            service = p[1:-1]
                            break
                    err_type = "GenericError"
                    if "EXCEPTION" in line.upper():
                        err_type = "Exception"
                    errors.append(RawErrorLog(
                        error_type=err_type,
                        service_name=service,
                        signature=line,
                    ))
            return errors

    def output_schema(self) -> type[BaseModel]:
        return LogSummary
