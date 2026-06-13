"""
Abstract base class for all pipeline agents.

Every agent in the LangGraph pipeline inherits from AgentBase.
The contract ensures agents:
1. Accept the full InvestigationState
2. Return a partial state update dict
3. Declare their output schema (Pydantic model)
4. Can validate their output against that schema
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel


class AgentBase(ABC):
    """Base class for all pipeline agents."""

    @abstractmethod
    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Execute agent logic and return a partial InvestigationState update.
        
        Args:
            state: The full InvestigationState dict from LangGraph
            
        Returns:
            Dict with only the keys this agent updates (partial state merge)
        """

    @abstractmethod
    def output_schema(self) -> type[BaseModel]:
        """Return the Pydantic model class for this agent's output."""

    def _validate_output(self, raw: dict[str, Any]) -> BaseModel:
        """Validate raw output dict against this agent's output schema.
        
        Args:
            raw: Raw dict to validate
            
        Returns:
            Validated Pydantic model instance
            
        Raises:
            ValueError: If validation fails (triggers orchestrator error_handler)
        """
        schema = self.output_schema()
        try:
            return schema.model_validate(raw)
        except Exception as exc:
            raise ValueError(
                f"{self.__class__.__name__} output validation failed: {exc}"
            ) from exc
    
    @property
    def agent_name(self) -> str:
        """Snake-case name used in agent_outputs table and state keys."""
        # e.g. AlertAgent -> alert_agent
        name = self.__class__.__name__
        # Convert CamelCase to snake_case
        import re
        return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()
