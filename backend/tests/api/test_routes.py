"""API route integration and routing tests."""

from __future__ import annotations

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.models.investigation import Investigation, InvestigationStatus, WorkflowStage
from app.models.agent_output import AgentOutput
from app.models.postmortem import Postmortem, PostmortemStatus


@pytest.fixture
def mock_db():
    """Fixture to provide a mocked database session."""
    session = AsyncMock()
    session.__aenter__.return_value = session
    session.add = MagicMock()
    session.flush = AsyncMock()
    return session


@pytest.fixture
def client(mock_db):
    """Fixture to provide a FastAPI TestClient with database overrides."""
    app.dependency_overrides[get_db] = lambda: mock_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# ── Incident Route Tests ─────────────────────────────────────────────────────

def test_submit_incident_success(client, mock_db):
    """POST /incident with valid payload should return 202 and queue workflow."""
    payload = {
        "service_name": "checkout-service",
        "environment": "production",
        "timestamp": "2026-06-15T04:00:00Z",
        "alert_data": {"metric": "latency", "value": 550},
        "logs": "2026-06-15 04:00:00 ERROR: Connection timed out to payment gateway",
    }

    # Mock the background task execution to prevent actual execution of LangGraph
    with patch("app.api.routes.incidents.run_investigation_workflow") as mock_workflow:
        response = client.post("/api/v1/incident", json=payload)
        
        assert response.status_code == 202
        data = response.json()
        assert "investigation_id" in data
        assert data["status"] == "pending"
        
        # Verify db insert
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        
        # Check background task enqueued
        mock_workflow.assert_called_once()


def test_submit_incident_validation_error(client):
    """POST /incident with invalid/missing fields should return 422 validation error."""
    payload = {
        "service_name": "checkout-service",
        # Missing 'logs' and 'alert_data'
    }
    response = client.post("/api/v1/incident", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error_code"] == "VALIDATION_ERROR"
    assert "errors" in data


def test_get_investigation_invalid_uuid(client):
    """GET /incident/{id} with malformed UUID should return 400."""
    response = client.get("/api/v1/incident/invalid-uuid-123")
    assert response.status_code == 400
    assert "Malformed investigation ID format" in response.json()["message"]


def test_get_investigation_not_found(client, mock_db):
    """GET /incident/{id} when not found should return 404."""
    fake_id = str(uuid.uuid4())
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    response = client.get(f"/api/v1/incident/{fake_id}")
    assert response.status_code == 404
    assert "not found" in response.json()["message"].lower()


def test_get_investigation_status_success(client, mock_db):
    """GET /incident/{id} for existing investigation should return full status and agent outputs."""
    fake_id = str(uuid.uuid4())
    
    mock_investigation = MagicMock(spec=Investigation)
    mock_investigation.id = fake_id
    mock_investigation.status = InvestigationStatus.running
    mock_investigation.stage = WorkflowStage.root_cause_analysis

    mock_agent_output = MagicMock(spec=AgentOutput)
    mock_agent_output.agent_name = "alert_agent"
    mock_agent_output.output = {"summary": "Alert is verified"}

    # Mock DB executions
    # First query retrieves the Investigation
    # Second query retrieves the AgentOutputs
    mock_res_investigation = MagicMock()
    mock_res_investigation.scalar_one_or_none.return_value = mock_investigation

    mock_res_outputs = MagicMock()
    mock_res_outputs.scalars.return_value.all.return_value = [mock_agent_output]

    mock_db.execute.side_effect = [mock_res_investigation, mock_res_outputs]

    response = client.get(f"/api/v1/incident/{fake_id}")
    assert response.status_code == 200
    data = response.json()
    
    assert data["investigation_id"] == fake_id
    assert data["status"] == "running"
    assert data["stage"] == "root_cause_analysis"
    assert len(data["agent_outputs"]) == 1
    assert data["agent_outputs"][0]["agent_name"] == "alert_agent"
    assert data["agent_outputs"][0]["output"] == {"summary": "Alert is verified"}


# ── Report Route Tests ───────────────────────────────────────────────────────

def test_get_report_pending(client, mock_db):
    """GET /report/{id} when postmortem record does not exist yet (pending) should return 202."""
    fake_id = str(uuid.uuid4())
    
    mock_investigation = MagicMock(spec=Investigation)
    mock_investigation.status = InvestigationStatus.running
    
    # First query (Investigation): exists
    mock_res_inv = MagicMock()
    mock_res_inv.scalar_one_or_none.return_value = mock_investigation
    
    # Second query (Postmortem): None
    mock_res_pm = MagicMock()
    mock_res_pm.scalar_one_or_none.return_value = None

    mock_db.execute.side_effect = [mock_res_inv, mock_res_pm]

    response = client.get(f"/api/v1/report/{fake_id}")
    assert response.status_code == 202
    assert response.json()["postmortem_status"] == "pending"


def test_get_report_failed(client, mock_db):
    """GET /report/{id} when investigation failed should return status incomplete_inputs."""
    fake_id = str(uuid.uuid4())
    
    mock_investigation = MagicMock(spec=Investigation)
    mock_investigation.status = InvestigationStatus.failed
    
    # First query (Investigation): exists, failed
    mock_res_inv = MagicMock()
    mock_res_inv.scalar_one_or_none.return_value = mock_investigation
    
    # Second query (Postmortem): None
    mock_res_pm = MagicMock()
    mock_res_pm.scalar_one_or_none.return_value = None

    mock_db.execute.side_effect = [mock_res_inv, mock_res_pm]

    response = client.get(f"/api/v1/report/{fake_id}")
    assert response.status_code == 200
    assert response.json()["postmortem_status"] == "incomplete_inputs"


def test_get_report_ready_and_markdown(client, mock_db):
    """GET /report/{id} ready should return JSON by default or markdown download if requested."""
    fake_id = str(uuid.uuid4())
    
    mock_investigation = MagicMock(spec=Investigation)
    mock_investigation.status = InvestigationStatus.completed

    mock_pm = MagicMock(spec=Postmortem)
    mock_pm.id = fake_id
    mock_pm.status = PostmortemStatus.ready
    mock_pm.sections = [
        {"heading": "Executive Summary", "body": "Everything is fine.", "source_agent": "alert_agent"}
    ]

    # Test JSON retrieval
    mock_res_inv = MagicMock()
    mock_res_inv.scalar_one_or_none.return_value = mock_investigation
    mock_res_pm = MagicMock()
    mock_res_pm.scalar_one_or_none.return_value = mock_pm

    mock_db.execute.side_effect = [mock_res_inv, mock_res_pm]

    response = client.get(f"/api/v1/report/{fake_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["postmortem_status"] == "ready"
    assert data["sections"][0]["heading"] == "Executive Summary"

    # Test Markdown format retrieval
    mock_res_inv2 = MagicMock()
    mock_res_inv2.scalar_one_or_none.return_value = mock_investigation
    mock_res_pm2 = MagicMock()
    mock_res_pm2.scalar_one_or_none.return_value = mock_pm
    mock_db.execute.side_effect = [mock_res_inv2, mock_res_pm2]

    response_md = client.get(f"/api/v1/report/{fake_id}?format=markdown")
    assert response_md.status_code == 200
    assert response_md.headers["content-type"] == "text/markdown; charset=utf-8"
    assert "Executive Summary" in response_md.text
    assert "attachment; filename=" in response_md.headers["content-disposition"]


# ── Recommendations Route Tests ──────────────────────────────────────────────

def test_get_recommendations_failed(client, mock_db):
    """GET /recommendations/{id} on failed investigation returns 422."""
    fake_id = str(uuid.uuid4())
    
    mock_investigation = MagicMock(spec=Investigation)
    mock_investigation.status = InvestigationStatus.failed

    mock_res_inv = MagicMock()
    mock_res_inv.scalar_one_or_none.return_value = mock_investigation
    mock_db.execute.return_value = mock_res_inv

    response = client.get(f"/api/v1/recommendations/{fake_id}")
    assert response.status_code == 422
    assert "failed" in response.json()["message"]


def test_get_recommendations_completed(client, mock_db):
    """GET /recommendations/{id} ready returns list of recommendations."""
    fake_id = str(uuid.uuid4())
    
    mock_investigation = MagicMock(spec=Investigation)
    mock_investigation.status = InvestigationStatus.completed

    mock_agent_output = MagicMock(spec=AgentOutput)
    mock_agent_output.output = {
        "steps": [
            {
                "action": "Restart container",
                "category": "operational",
                "rationale": "Clear buffer memory",
                "confidence": "supported",
            }
        ]
    }

    mock_res_inv = MagicMock()
    mock_res_inv.scalar_one_or_none.return_value = mock_investigation
    mock_res_out = MagicMock()
    mock_res_out.scalar_one_or_none.return_value = mock_agent_output

    mock_db.execute.side_effect = [mock_res_inv, mock_res_out]

    response = client.get(f"/api/v1/recommendations/{fake_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["recommendations_status"] == "completed"
    assert len(data["steps"]) == 1
    assert data["steps"][0]["action"] == "Restart container"


# ── Ingest Route Tests ───────────────────────────────────────────────────────

def test_ingest_document_success(client):
    """POST /ingest with supported file type should return 202."""
    files = {"file": ("runbook.md", b"# Markdown content", "text/markdown")}
    
    with patch("app.api.routes.ingest.ingest_document") as mock_ingest:
        response = client.post("/api/v1/ingest", files=files)
        assert response.status_code == 202
        assert response.json()["status"] == "pending"
        mock_ingest.assert_called_once()


def test_ingest_document_unsupported_format(client):
    """POST /ingest with unsupported file type should return 400."""
    files = {"file": ("unsupported.png", b"dummy png binary data", "image/png")}
    response = client.post("/api/v1/ingest", files=files)
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["message"]
