"""
MCP client wrappers for filesystem, github, and browser server types.

These wrappers provide a consistent `call_tool(tool, args)` interface
regardless of whether the MCP Python SDK is available. When the SDK is
present and the server is configured, a real subprocess-backed client is
used. When the SDK is absent or the server is not configured, the stub
client logs a warning and returns None immediately — graceful degradation
so the rest of the pipeline is unaffected.
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Attempt to import the MCP SDK.  If it is not installed, all real client
# instantiation silently falls back to the stub.
# ---------------------------------------------------------------------------
try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    _MCP_AVAILABLE = True
except ImportError:  # pragma: no cover
    _MCP_AVAILABLE = False
    logger.warning(
        "mcp_sdk_not_installed",
        reason="mcp package not found; all MCP tool calls will return None",
    )


# ---------------------------------------------------------------------------
# Stub — used when the SDK is missing or server is not configured
# ---------------------------------------------------------------------------


class _StubMCPClient:
    """No-op client returned when the real MCP client cannot be created."""

    def __init__(self, server_name: str) -> None:
        self._server_name = server_name

    async def call_tool(self, tool: str, args: dict) -> Any:  # noqa: ARG002
        logger.warning(
            "mcp_stub_call",
            server=self._server_name,
            tool=tool,
            reason="MCP server not configured or SDK unavailable",
        )
        return None


# ---------------------------------------------------------------------------
# Real stdio-backed client
# ---------------------------------------------------------------------------


class _StdioMCPClient:
    """
    Wraps an MCP `ClientSession` over a stdio subprocess transport.

    The session is lazily initialised on the first `call_tool` invocation
    (or explicitly via `initialize()`).  Closing is idempotent.
    """

    def __init__(self, server_params: "StdioServerParameters", server_name: str) -> None:
        if not _MCP_AVAILABLE:
            raise RuntimeError("MCP SDK is not installed")
        self._server_params = server_params
        self._server_name = server_name
        self._session: ClientSession | None = None
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        """Start the subprocess and initialise the MCP session."""
        async with self._lock:
            if self._session is not None:
                return
            # stdio_client is an async context manager; we enter it once and
            # keep the session alive for the lifetime of the registry.
            self._cm = stdio_client(self._server_params)
            read, write = await self._cm.__aenter__()
            self._session = ClientSession(read, write)
            await self._session.__aenter__()
            await self._session.initialize()
            logger.info("mcp_server_connected", server=self._server_name)

    async def call_tool(self, tool: str, args: dict) -> Any:
        if self._session is None:
            await self.initialize()
        return await self._session.call_tool(tool, args)

    async def close(self) -> None:
        async with self._lock:
            if self._session is not None:
                try:
                    await self._session.__aexit__(None, None, None)
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "mcp_session_close_error",
                        server=self._server_name,
                        reason=str(exc),
                    )
                finally:
                    self._session = None
            if hasattr(self, "_cm"):
                try:
                    await self._cm.__aexit__(None, None, None)
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "mcp_transport_close_error",
                        server=self._server_name,
                        reason=str(exc),
                    )


# ---------------------------------------------------------------------------
# Factory helpers — one per server type
# ---------------------------------------------------------------------------


def build_filesystem_client(
    allowed_directory: str,
) -> _StdioMCPClient | _StubMCPClient:
    """Return a client for the filesystem MCP server.

    Args:
        allowed_directory: The root directory exposed to the filesystem server.
    """
    if not _MCP_AVAILABLE:
        return _StubMCPClient("filesystem")
    params = StdioServerParameters(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-filesystem", allowed_directory],
    )
    return _StdioMCPClient(params, "filesystem")


def build_github_client(github_token: str) -> _StdioMCPClient | _StubMCPClient:
    """Return a client for the GitHub MCP server.

    Args:
        github_token: A GitHub personal access token (or fine-grained token).
    """
    if not _MCP_AVAILABLE:
        return _StubMCPClient("github")
    params = StdioServerParameters(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-github"],
        env={"GITHUB_PERSONAL_ACCESS_TOKEN": github_token},
    )
    return _StdioMCPClient(params, "github")


def build_browser_client() -> _StdioMCPClient | _StubMCPClient:
    """Return a client for the browser / Puppeteer MCP server."""
    if not _MCP_AVAILABLE:
        return _StubMCPClient("browser")
    params = StdioServerParameters(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-puppeteer"],
    )
    return _StdioMCPClient(params, "browser")


# Public type alias for type hints in registry.py
MCPClient = _StdioMCPClient | _StubMCPClient
