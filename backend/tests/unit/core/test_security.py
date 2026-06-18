"""
Unit tests for log sanitization and PII/credential scrubbing.
"""

from __future__ import annotations

from app.core.security import sanitize_logs

def test_sanitize_logs_no_secrets():
    text = "2026-06-16T02:00:00Z [INFO] system started successfully. All connections OK."
    assert sanitize_logs(text) == text

def test_sanitize_logs_database_url():
    text = "Failed to connect to database: postgresql://postgres:mypassword123@db-host-primary:5432/production_db"
    expected = "Failed to connect to database: postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@db-host-primary:5432/production_db"
    assert sanitize_logs(text) == expected

def test_sanitize_logs_jwt_token():
    text = "Authorization header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    expected = "Authorization header: Bearer [REDACTED_JWT_TOKEN]"
    assert sanitize_logs(text) == expected

def test_sanitize_logs_api_keys():
    text_openai = "Connecting with API Key: sk-proj-123456789012345678901234567890123456789012345678"
    assert "[REDACTED_API_KEY]" in sanitize_logs(text_openai)

    text_google = "Map API loaded key: AIzaSyD-1234567890_1234567890123456789"
    assert "[REDACTED_API_KEY]" in sanitize_logs(text_google)

def test_sanitize_logs_aws_keys():
    text = "AWS config failed. AKIAIOSFODNN7EXAMPLE and secret key is wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    sanitized = sanitize_logs(text)
    assert "AKIAIOSFODNN7EXAMPLE" not in sanitized
    assert "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" not in sanitized
    assert "REDACTED_AWS" in sanitized

def test_sanitize_logs_email():
    text = "User admin@company.com failed to login from 10.0.0.1"
    expected = "User [REDACTED_EMAIL] failed to login from 10.0.0.1"
    assert sanitize_logs(text) == expected

def test_sanitize_logs_key_values():
    text1 = "DBConfig password=my-super-secret-pass, host=localhost"
    assert "my-super-secret-pass" not in sanitize_logs(text1)
    assert "[REDACTED_PASSWORD]" in sanitize_logs(text1)

    text2 = '{"session_id": "session-1234567", "status": "active"}'
    assert "session-1234567" not in sanitize_logs(text2)
    assert "[REDACTED_SESSION_ID]" in sanitize_logs(text2)
