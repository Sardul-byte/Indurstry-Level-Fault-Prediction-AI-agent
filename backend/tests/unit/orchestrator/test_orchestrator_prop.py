"""
Property-based tests for LangGraph state machine routing rules.
"""

from __future__ import annotations

import pytest
from hypothesis import given, strategies as st

from app.orchestrator.graph import (
    route_after_alert,
    route_after_log_analysis,
    route_after_retrieval,
    route_after_rca,
    route_after_reremediation,
)


@given(has_error=st.booleans())
def test_property_routing_logic(has_error: bool):
    """Property: Any node execution that sets an error redirects the orchestrator to the error handler."""
    state = {"error": {"message": "Crash", "agent_name": "test"} if has_error else None}
    
    # Assert routing behavior matches error status
    assert route_after_alert(state) == ("error_handler" if has_error else "log_analysis_agent")
    assert route_after_log_analysis(state) == ("error_handler" if has_error else "retrieval_agent")
    assert route_after_retrieval(state) == ("error_handler" if has_error else "rca_agent")
    assert route_after_rca(state) == ("error_handler" if has_error else "remediation_agent")
    assert route_after_reremediation(state) == ("error_handler" if has_error else "postmortem_agent")
