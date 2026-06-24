"""
Application settings loaded from environment variables via pydantic-settings.

Usage:
    from app.core.config import settings
"""

from __future__ import annotations

import logging
import sys

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_stdlib_log = logging.getLogger(__name__)

VALID_LLM_PROVIDERS = {"gemini", "openai", "anthropic"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM provider ─────────────────────────────────────────────────────────
    LLM_PROVIDER: str = "gemini"
    LLM_MODEL: str = "gemini-2.0-flash"

    # ── API keys ──────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # ── Vector store ──────────────────────────────────────────────────────────
    QDRANT_URL: str = ":memory:"
    QDRANT_COLLECTION: str = "knowledge_base"

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./dev.db"

    # ── LangSmith / tracing ───────────────────────────────────────────────────
    LANGSMITH_API_KEY: str = ""
    LANGCHAIN_TRACING_V2: str = "false"
    LANGCHAIN_PROJECT: str = "ai-incident-response-commander"

    # ── MCP ───────────────────────────────────────────────────────────────────
    MCP_TIMEOUT_SECONDS: int = 10
    MCP_RESPONSE_CAP: int = 50000

    # ── RAG ───────────────────────────────────────────────────────────────────
    RAG_K: int = 5
    RAG_SIMILARITY_THRESHOLD: float = 0.5

    # ── API server ────────────────────────────────────────────────────────────
    API_PORT: int = 8000
    MAX_PAYLOAD_SIZE_MB: int = 50

    # ── Validators ───────────────────────────────────────────────────────────

    @field_validator("LLM_PROVIDER", mode="before")
    @classmethod
    def validate_llm_provider(cls, v: str) -> str:
        if v not in VALID_LLM_PROVIDERS:
            raise ValueError(
                f"LLM_PROVIDER must be one of {sorted(VALID_LLM_PROVIDERS)}, got '{v}'"
            )
        return v

    @field_validator("RAG_K", mode="before")
    @classmethod
    def validate_rag_k(cls, v: int) -> int:
        v = int(v)
        if not (1 <= v <= 20):
            raise ValueError(f"RAG_K must be between 1 and 20, got {v}")
        return v

    @model_validator(mode="after")
    def warn_on_missing_api_key(self) -> "Settings":
        """Warn (but don't fail) when the configured provider has no API key in dev."""
        key_map = {
            "gemini": ("GEMINI_API_KEY", self.GEMINI_API_KEY),
            "openai": ("OPENAI_API_KEY", self.OPENAI_API_KEY),
            "anthropic": ("ANTHROPIC_API_KEY", self.ANTHROPIC_API_KEY),
        }
        var_name, value = key_map[self.LLM_PROVIDER]
        if not value:
            _stdlib_log.warning(
                "LLM provider '%s' selected but %s is empty. "
                "LLM calls will fail unless a key is supplied at runtime.",
                self.LLM_PROVIDER,
                var_name,
            )
        return self


def validate_on_startup() -> None:
    """
    Check that critical runtime env vars are non-empty.

    Logs the missing variable name and calls sys.exit(1) if any are absent.
    Should be called once during application startup (e.g. lifespan handler).
    """
    required: list[tuple[str, str]] = [
        ("QDRANT_URL", settings.QDRANT_URL),
        ("DATABASE_URL", settings.DATABASE_URL),
    ]
    for var_name, value in required:
        if not value:
            _stdlib_log.error(
                "Required environment variable '%s' is missing or empty. "
                "Set it in your .env file or container environment.",
                var_name,
            )
            sys.exit(1)


# Module-level singleton — import this everywhere.
settings = Settings()
