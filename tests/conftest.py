"""Shared fixtures for discord-mcp tests."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from discord_mcp.server import app
from discord_mcp.state import _state
from tests.helpers import discord_response


@pytest.fixture(autouse=True)
def _token(monkeypatch):
    monkeypatch.setenv("DISCORD_TOKEN", "test-token")


@pytest.fixture(autouse=True)
def _reset_state():
    _state.clear_rate_limit_data()
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_discord():
    """Patch `_discord_request` and return the mock for configuring return values."""
    with patch("discord_mcp.portmanteau._discord_request", new_callable=AsyncMock) as m:
        yield m


def discord_ok(json_body: dict | list | None = None, status: int = 200, method: str = "GET") -> AsyncMock:
    """Return an AsyncMock that returns a 200 Discord response with optional body."""
    m = AsyncMock()
    m.return_value = discord_response(status, json_body=json_body or {}, method=method)
    return m
