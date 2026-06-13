"""
MCP Tool Registry — manages MCP server connections and enforces:

* 10 s timeout per tool call (asyncio.wait_for, configurable via settings).
* 50,000 character cap on every response (truncate before returning).
* Fail-open: TimeoutError or any exception is logged with
  {tool, server, reason, timestamp} and the call returns None so that
  agent execution is never blocked by an MCP failure.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger
from app.mcp.clients import (
    MCPClient,
    build_browser_client,
    build_filesystem_client,
    build_github_client,
)

logger = get_logger(__name__)


class MCPRegistry:
    """Registry of MCP server connections with timeout and cap enforcement."""

    def __init__(self) -> None:
        self._servers: dict[str, MCPClient] = {}  # server_name -> MCPClient
        self._initialized: bool = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Start MCP server subprocesses via stdio transport.

        Servers are optional — missing config is logged as a warning, not an
        error, so the system works without any MCP server configured.

        Environment variables checked:
        - MCP_FILESYSTEM_ROOT  : path exposed to the filesystem server
        - GITHUB_TOKEN         : GitHub personal access token
        (browser server requires no configuration)
        """
        if self._initialized:
            return

        # --- Filesystem MCP ---
        filesystem_root = os.getenv("MCP_FILESYSTEM_ROOT", "")
        if filesystem_root:
            try:
                client = build_filesystem_client(filesystem_root)
                # Eagerly initialise so startup errors are surfaced now, not at
                # the first tool call during an investigation.
                if hasattr(client, "initialize"):
                    await client.initialize()
                self._servers["filesystem"] = client
                logger.info("mcp_server_registered", server="filesystem")
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "mcp_server_init_failed",
                    server="filesystem",
                    reason=str(exc),
                )
        else:
            logger.warning(
                "mcp_server_not_configured",
                server="filesystem",
                reason="MCP_FILESYSTEM_ROOT not set; filesystem MCP disabled",
            )

        # --- GitHub MCP ---
        github_token = os.getenv("GITHUB_TOKEN", "")
        if github_token:
            try:
                client = build_github_client(github_token)
                if hasattr(client, "initialize"):
                    await client.initialize()
                self._servers["github"] = client
                logger.info("mcp_server_registered", server="github")
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "mcp_server_init_failed",
                    server="github",
                    reason=str(exc),
                )
        else:
            logger.warning(
                "mcp_server_not_configured",
                server="github",
                reason="GITHUB_TOKEN not set; GitHub MCP disabled",
            )

        # --- Browser MCP (no required config) ---
        try:
            client = build_browser_client()
            if hasattr(client, "initialize"):
                await client.initialize()
            self._servers["browser"] = client
            logger.info("mcp_server_registered", server="browser")
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "mcp_server_init_failed",
                server="browser",
                reason=str(exc),
            )

        self._initialized = True
        logger.info(
            "mcp_registry_initialized",
            active_servers=list(self._servers.keys()),
        )

    async def close(self) -> None:
        """Close all MCP server connections."""
        for server_name, client in list(self._servers.items()):
            if hasattr(client, "close"):
                try:
                    await client.close()
                    logger.info("mcp_server_closed", server=server_name)
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "mcp_server_close_error",
                        server=server_name,
                        reason=str(exc),
                    )
        self._servers.clear()
        self._initialized = False

    # ------------------------------------------------------------------
    # Tool invocation
    # ------------------------------------------------------------------

    async def call_tool(self, server: str, tool: str, args: dict) -> str | None:
        """Call an MCP tool with timeout and response cap.

        The method is fail-open: any error causes a structured log entry and
        returns None so the calling agent continues with available context.

        Args:
            server: MCP server name, one of ``"filesystem"``, ``"github"``,
                    ``"browser"``.
            tool:   Tool name as defined by the MCP server.
            args:   Keyword arguments forwarded to the tool.

        Returns:
            Tool response truncated to ``settings.MCP_RESPONSE_CAP`` characters,
            or ``None`` on failure.
        """
        if server not in self._servers:
            logger.warning("mcp_server_not_available", server=server, tool=tool)
            return None

        try:
            result = await asyncio.wait_for(
                self._servers[server].call_tool(tool, args),
                timeout=settings.MCP_TIMEOUT_SECONDS,
            )
            content = _extract_content(result)
            # Cap response at MCP_RESPONSE_CAP characters (Requirement 11.5)
            return content[: settings.MCP_RESPONSE_CAP]

        except asyncio.TimeoutError:
            logger.error(
                "mcp_tool_timeout",
                tool=tool,
                server=server,
                reason="timeout",
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            return None

        except Exception as exc:  # noqa: BLE001
            logger.error(
                "mcp_tool_failed",
                tool=tool,
                server=server,
                reason=str(exc),
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            return None


# ---------------------------------------------------------------------------
# Content extraction helper
# ---------------------------------------------------------------------------


def _extract_content(result: Any) -> str:
    """Extract a plain string from an MCP tool result.

    The MCP SDK can return several shapes depending on the tool and version:
    - A plain ``str``
    - An object with a ``content`` attribute that is either a ``str`` or a
      list of content blocks (each with a ``text`` attribute)
    - Any other object — converted via ``str()``
    """
    if result is None:
        return ""
    if isinstance(result, str):
        return result
    if hasattr(result, "content"):
        content = result.content
        if isinstance(content, list):
            return "\n".join(
                item.text if hasattr(item, "text") else str(item)
                for item in content
            )
        return str(content)
    return str(result)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

mcp_registry = MCPRegistry()
