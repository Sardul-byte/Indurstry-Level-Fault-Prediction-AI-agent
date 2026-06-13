"""
LLM provider factory with exponential backoff retry.

Usage:
    from app.llm.provider import LLMProvider

    llm = LLMProvider.get()               # uses settings.LLM_PROVIDER
    llm = LLMProvider.get("gemini-2.0-flash")  # override model name
"""

from __future__ import annotations

from langchain_core.language_models import BaseChatModel

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class LLMProvider:
    """Factory that instantiates the configured LLM provider and wraps it with retry logic."""

    PROVIDERS: dict[str, type] = {}

    @classmethod
    def _ensure_providers(cls) -> None:
        """Lazily populate PROVIDERS to avoid top-level provider imports elsewhere."""
        if cls.PROVIDERS:
            return
        # All provider-specific imports are confined to this file.
        from langchain_anthropic import ChatAnthropic  # noqa: PLC0415
        from langchain_google_genai import ChatGoogleGenerativeAI  # noqa: PLC0415
        from langchain_openai import ChatOpenAI  # noqa: PLC0415

        cls.PROVIDERS = {
            "gemini": ChatGoogleGenerativeAI,
            "openai": ChatOpenAI,
            "anthropic": ChatAnthropic,
        }

    @classmethod
    def get(cls, model_name: str | None = None) -> BaseChatModel:
        """Return an LLM instance for the configured provider, wrapped with retry.

        Args:
            model_name: Optional model identifier. Defaults to ``settings.LLM_MODEL``.

        Returns:
            A ``BaseChatModel`` instance with exponential backoff retry applied.

        Raises:
            ValueError: If ``settings.LLM_PROVIDER`` is not one of the supported providers.
        """
        cls._ensure_providers()

        provider_key = settings.LLM_PROVIDER.lower()
        if provider_key not in cls.PROVIDERS:
            raise ValueError(
                f"Unsupported LLM_PROVIDER '{provider_key}'. "
                f"Must be one of: {sorted(cls.PROVIDERS.keys())}"
            )

        resolved_model = model_name or settings.LLM_MODEL
        provider_class = cls.PROVIDERS[provider_key]

        logger.info(
            "llm_provider_init",
            provider=provider_key,
            model=resolved_model,
        )

        llm: BaseChatModel = provider_class(model=resolved_model)
        return cls._with_retry(llm)

    @staticmethod
    def _with_retry(llm: BaseChatModel) -> BaseChatModel:
        """Wrap *llm* with exponential backoff retry for transient errors.

        Retry policy:
        - Retries on ``RateLimitError`` (HTTP 429) and ``ServiceUnavailableError`` (HTTP 503)
        - Up to 3 total attempts (i.e. 2 retries)
        - Wait between attempts: 1 s, 2 s, 4 s (exponential, capped at 4 s)
        - Non-retryable errors bubble up immediately without retry

        Args:
            llm: The base chat model to wrap.

        Returns:
            A ``Runnable`` that behaves like the original LLM but retries on transient errors.
        """
        # Import error types here to keep the dependency isolated.
        # langchain-google-genai / langchain-openai / langchain-anthropic all
        # surface these as subclasses or re-exports of the same openai/google
        # exception hierarchy, but LangChain's .with_retry() accepts any
        # exception type via retry_if_exception_type.
        from tenacity import retry_if_exception_type, stop_after_attempt, wait_exponential

        try:
            # Prefer openai's canonical exception types — they are re-used by
            # most LangChain provider packages.
            from openai import RateLimitError, APIStatusError
            retryable = (RateLimitError, APIStatusError)
        except ImportError:
            # Fallback: use a broad Exception base so retry still works if
            # openai isn't installed (unlikely given pyproject.toml, but safe).
            retryable = (Exception,)  # type: ignore[assignment]

        return llm.with_retry(
            retry_if_exception_type=retryable,
            stop_after_attempt=3,
            wait_exponential_jitter=False,
            # tenacity kwargs forwarded through with_retry:
            # wait_exponential(multiplier=1, max=4) → 1s, 2s, 4s
            reraise=True,
        )
