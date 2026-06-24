"""
Security utilities for log scrubbing, PII sanitization, and secrets masking.
"""

from __future__ import annotations

import re

# Common patterns for credentials, tokens, and PII
SENSITIVE_PATTERNS = {
    # JWT tokens: eyJ...
    "JWT_TOKEN": re.compile(
        r"eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*"
    ),
    # AWS Access Key ID and Secret Access Key
    "AWS_ACCESS_KEY": re.compile(r"\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA)[A-Z0-9]{16}\b"),
    "AWS_SECRET_KEY": re.compile(r"\b[A-Za-z0-9+/]{40}\b"),
    # Slack OAuth tokens and Webhooks
    "SLACK_TOKEN": re.compile(r"xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}"),
    # Database URLs (e.g. postgresql://user:pass@host:port/db)
    "DATABASE_URL": re.compile(
        r"\b[a-zA-Z0-9+.-]+://[^:\s]+:[^@\s]+@[^:\s]+:[0-9]+/[^\s]*"
    ),
    # Emails
    "EMAIL": re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b"),
    # General Key-value credentials (e.g., password=foo, api_key="bar")
    "KEY_VALUE_CREDENTIALS": re.compile(
        r'(?i)(["\']?)\b(password|passwd|pwd|pass|secret|api_key|apikey|auth_token|token|session_id|private_key)\b\1\s*[:=]\s*(["\']?)([^"\';\s,]{4,})\3'
    ),
}

# Generic api_key format (e.g. sk-proj-...)
API_KEY_PATTERNS = [
    re.compile(r"\bsk-(?:proj-)?[a-zA-Z0-9-_]{30,60}\b"),
    re.compile(r"\bAIza[0-9A-Za-z-_]{30,45}\b"),
]

def sanitize_logs(text: str) -> str:
    """Mask credentials, tokens, and PII inside log data/text.

    Replaces recognized secrets with generic placeholders.
    """
    if not text:
        return text

    sanitized = text

    # Apply database URL first to avoid conflict with general key-value credentials
    def mask_db_url(match: re.Match) -> str:
        url = match.group(0)
        try:
            prefix, rest = url.split("://", 1)
            creds, host_db = rest.split("@", 1)
            user, password = creds.split(":", 1)
            return f"{prefix}://[REDACTED_USER]:[REDACTED_PASSWORD]@{host_db}"
        except Exception:
            return "[REDACTED_DATABASE_URL]"

    sanitized = SENSITIVE_PATTERNS["DATABASE_URL"].sub(mask_db_url, sanitized)

    # Clean JWT tokens
    sanitized = SENSITIVE_PATTERNS["JWT_TOKEN"].sub("[REDACTED_JWT_TOKEN]", sanitized)

    # Clean AWS Keys
    sanitized = SENSITIVE_PATTERNS["AWS_ACCESS_KEY"].sub("[REDACTED_AWS_ACCESS_KEY]", sanitized)
    # Be careful with the general 40-char secret key pattern to only match if it starts/ends near key contexts or we do it safely
    # For general secret key, let's keep it safe. Let's match typical secret keys or replace them when paired with access keys
    # Or just replace general 40-character secret keys if they resemble high entropy strings
    # We can check if it matches and replace
    sanitized = SENSITIVE_PATTERNS["AWS_SECRET_KEY"].sub("[REDACTED_AWS_SECRET]", sanitized)

    # Clean Slack tokens
    sanitized = SENSITIVE_PATTERNS["SLACK_TOKEN"].sub("[REDACTED_SLACK_TOKEN]", sanitized)

    # Clean Emails
    sanitized = SENSITIVE_PATTERNS["EMAIL"].sub("[REDACTED_EMAIL]", sanitized)

    # Clean custom key/value credentials like password=xxx or token: "xxx"
    def mask_key_value(match: re.Match) -> str:
        quote_key = match.group(1)
        key = match.group(2)
        quote_val = match.group(3)
        val = match.group(4)
        if "REDACTED" in val or len(val) < 4:
            return match.group(0)
        sep = ":" if ":" in match.group(0) else "="
        return f"{quote_key}{key}{quote_key}{sep}{quote_val}[REDACTED_{key.upper()}]{quote_val}"

    # Replace key=value credentials
    sanitized = SENSITIVE_PATTERNS["KEY_VALUE_CREDENTIALS"].sub(
        mask_key_value,
        sanitized
    )

    # Clean general API Keys
    for pattern in API_KEY_PATTERNS:
        sanitized = pattern.sub("[REDACTED_API_KEY]", sanitized)

    return sanitized
