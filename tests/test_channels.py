"""REST endpoint tests for channel CRUD routes (discord_tool mocked)."""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from discord_mcp.server import app

client = TestClient(app)


@patch("discord_mcp.server.discord_tool", new_callable=AsyncMock)
def test_list_channels(mock_tool):
    mock_tool.return_value = {
        "success": True,
        "channels": [{"id": "c1", "name": "general", "type": 0}],
        "count": 1,
    }
    resp = client.get("/api/v1/guilds/g1/channels")
    assert resp.status_code == 200
    assert resp.json()["count"] == 1


@patch("discord_mcp.server.discord_tool", new_callable=AsyncMock)
def test_create_channel(mock_tool):
    mock_tool.return_value = {
        "success": True,
        "channel_id": "c2",
        "name": "new-channel",
        "type": 0,
        "guild_id": "g1",
    }
    resp = client.post("/api/v1/guilds/g1/channels", json={"name": "new-channel", "type": 0})
    assert resp.status_code == 200
    assert resp.json()["channel_id"] == "c2"


@patch("discord_mcp.server.discord_tool", new_callable=AsyncMock)
def test_create_channel_missing_name(mock_tool):
    resp = client.post("/api/v1/guilds/g1/channels", json={"type": 0})
    assert resp.status_code == 422


@patch("discord_mcp.server.discord_tool", new_callable=AsyncMock)
def test_delete_channel(mock_tool):
    mock_tool.return_value = {"success": True, "channel_id": "c1", "deleted": True}
    resp = client.delete("/api/v1/channels/c1")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True


@patch("discord_mcp.server.discord_tool", new_callable=AsyncMock)
def test_delete_channel_api_error(mock_tool):
    mock_tool.return_value = {"success": False, "error": "Discord API 403: Missing Access"}
    resp = client.delete("/api/v1/channels/c1")
    assert resp.status_code == 502
