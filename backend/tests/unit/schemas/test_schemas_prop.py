"""
Property-based tests for Pydantic schemas using Hypothesis.
"""

from __future__ import annotations

from datetime import datetime, timezone
import pytest
from hypothesis import given, strategies as st
from pydantic import ValidationError

from app.schemas.incident import IncidentPayload
from app.schemas.agent_outputs import AlertSummary


@given(st.builds(IncidentPayload))
def test_property_incident_payload_generation(payload: IncidentPayload):
    """Property: Any built IncidentPayload conforms to fields and handles logs constraints."""
    assert isinstance(payload.alert_data, dict)
    assert isinstance(payload.logs, str)
    if payload.timestamp:
        assert isinstance(payload.timestamp, datetime)


@given(
    alert_type=st.sampled_from(["availability", "performance", "error_rate", "resource", "security", "custom"]),
    severity=st.sampled_from(["critical", "high", "medium", "low"]),
    impacted_services=st.lists(st.text(), max_size=20),
    classification_status=st.sampled_from(["classified", "unclassified", "parse_error"])
)
def test_property_alert_summary_fields(alert_type, severity, impacted_services, classification_status):
    """Property: AlertSummary validates correct enum and bound fields."""
    summary = AlertSummary(
        alert_type=alert_type,
        severity=severity,
        impacted_services=impacted_services,
        alert_timestamp=datetime.now(timezone.utc),
        classification_status=classification_status
    )
    assert summary.alert_type == alert_type
    assert len(summary.impacted_services) <= 20
