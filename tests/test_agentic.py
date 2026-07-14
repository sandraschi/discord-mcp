"""Tests for agentic workflow (sampling mocked)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from discord_mcp.agentic import discord_agentic_workflow


@pytest.mark.asyncio
async def test_agentic_workflow_success():
    ctx = SimpleNamespace()
    ctx.sample = AsyncMock(return_value=SimpleNamespace(text="Listed guilds and channels."))

    out = await discord_agentic_workflow("List guilds", ctx)
    assert out["success"] is True
    assert "Listed guilds" in out["message"]
    ctx.sample.assert_awaited_once()


@pytest.mark.asyncio
async def test_agentic_workflow_sampling_failure():
    ctx = SimpleNamespace()
    ctx.sample = AsyncMock(side_effect=RuntimeError("no LLM"))

    out = await discord_agentic_workflow("Ban spammers", ctx)
    assert out["success"] is False
    assert out["error_type"] == "agentic_workflow"
    assert "recovery_options" in out
