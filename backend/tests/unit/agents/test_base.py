"""Unit tests for AgentBase abstract class."""
from __future__ import annotations

import pytest
from pydantic import BaseModel

from app.agents.base import AgentBase


# ---------------------------------------------------------------------------
# Minimal concrete implementation for testing
# ---------------------------------------------------------------------------

class SampleOutput(BaseModel):
    value: int
    label: str


class ConcreteAgent(AgentBase):
    """Minimal agent used only in tests."""

    async def run(self, state: dict) -> dict:
        return {"value": 1, "label": "ok"}

    def output_schema(self) -> type[BaseModel]:
        return SampleOutput


class AnotherConcreteAgent(AgentBase):
    """Used to verify agent_name snake-case conversion."""

    async def run(self, state: dict) -> dict:
        return {}

    def output_schema(self) -> type[BaseModel]:
        return SampleOutput


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestAgentBase:
    """Tests for AgentBase contract."""

    def test_cannot_instantiate_abc_directly(self):
        """AgentBase itself must not be instantiatable."""
        with pytest.raises(TypeError):
            AgentBase()  # type: ignore[abstract]

    def test_concrete_agent_instantiates(self):
        agent = ConcreteAgent()
        assert isinstance(agent, AgentBase)

    # -- output_schema --

    def test_output_schema_returns_pydantic_model_class(self):
        agent = ConcreteAgent()
        schema = agent.output_schema()
        assert issubclass(schema, BaseModel)

    # -- _validate_output --

    def test_validate_output_returns_model_instance_on_valid_input(self):
        agent = ConcreteAgent()
        result = agent._validate_output({"value": 42, "label": "test"})
        assert isinstance(result, SampleOutput)
        assert result.value == 42
        assert result.label == "test"

    def test_validate_output_raises_value_error_on_invalid_input(self):
        agent = ConcreteAgent()
        with pytest.raises(ValueError, match="ConcreteAgent output validation failed"):
            agent._validate_output({"value": "not-an-int", "label": "x"})

    def test_validate_output_raises_value_error_on_missing_field(self):
        agent = ConcreteAgent()
        with pytest.raises(ValueError, match="ConcreteAgent output validation failed"):
            agent._validate_output({"value": 1})  # missing 'label'

    def test_validate_output_error_chains_original_exception(self):
        agent = ConcreteAgent()
        with pytest.raises(ValueError) as exc_info:
            agent._validate_output({"value": "bad"})
        # The original pydantic error should be chained as __cause__
        assert exc_info.value.__cause__ is not None

    # -- agent_name --

    def test_agent_name_converts_camel_to_snake_case(self):
        agent = ConcreteAgent()
        assert agent.agent_name == "concrete_agent"

    def test_agent_name_multi_word_class(self):
        agent = AnotherConcreteAgent()
        assert agent.agent_name == "another_concrete_agent"

    # -- run (async contract) --

    @pytest.mark.asyncio
    async def test_run_returns_dict(self):
        agent = ConcreteAgent()
        result = await agent.run({"investigation_id": "test-123"})
        assert isinstance(result, dict)
