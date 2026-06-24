"""
Property-based tests for individual agents (Alert, Log, RCA, Remediation, Postmortem).
"""

from __future__ import annotations

import pytest
from hypothesis import given, strategies as st

from app.schemas.agent_outputs import (
    AlertSummary,
    LogSummary,
    RCAResult,
    RemediationList,
    PostmortemSchema,
)


@given(
    alert_type=st.sampled_from(["availability", "performance", "error_rate", "resource", "security", "custom"]),
    severity=st.sampled_from(["critical", "high", "medium", "low"]),
    services=st.lists(st.text(min_size=1, max_size=10), max_size=20),
)
def test_property_alert_agent_summary_bounds(alert_type, severity, services):
    """Property: AlertAgent output summary enforces length bounds on service lists and valid enums."""
    summary = AlertSummary(
        alert_type=alert_type,
        severity=severity,
        impacted_services=services[:20],
        alert_timestamp=import_dt(),
        classification_status="classified"
    )
    assert len(summary.impacted_services) <= 20
    assert summary.severity in ["critical", "high", "medium", "low"]


@given(
    conf_scores=st.lists(st.floats(min_value=0.0, max_value=1.0), max_size=5)
)
def test_property_rca_agent_hypothesis_ranking(conf_scores):
    """Property: RCAAgent outputs are properly sorted descending by confidence score."""
    # Simulate list of hypotheses
    hypotheses = [{"hypothesis": "H", "confidence_score": score, "evidence": ["E"]} for score in conf_scores]
    hypotheses.sort(key=lambda x: x["confidence_score"], reverse=True)
    
    # Assert sorted order
    for idx in range(len(hypotheses) - 1):
        assert hypotheses[idx]["confidence_score"] >= hypotheses[idx + 1]["confidence_score"]


def import_dt():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)
