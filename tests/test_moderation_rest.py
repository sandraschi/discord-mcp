"""REST endpoint tests for moderation routes (discord_tool mocked)."""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from discord_mcp.server import app

client = TestClient(app)


@patch("discord_mcp.server.discord_tool", new_callable=AsyncMock)
def test_list_bans_endpoint(mock_tool):
    mock_tool.return_value = {"success": True, "bans": [{"user_id": "u1", "username": "x"}], "count": 1}
    resp = client.get("/api/v1/guilds/g1/bans")
    assert resp.status_code == 200
    assert resp.json()["count"] == 1


@patch("discord_mcp.server.discord_tool", new_callable=AsyncMock)
def test_list_roles_endpoint(mock_tool):
    mock_tool.return_value = {"success": True, "roles": [{"id": "r1", "name": "Mod"}], "count": 1}
    resp = client.get("/api/v1/guilds/g1/roles")
    assert resp.status_code == 200
    assert resp.json()["roles"][0]["name"] == "Mod"


@patch("discord_mcp.server.discord_tool", new_callable=AsyncMock)
def test_audit_log_endpoint(mock_tool):
    mock_tool.return_value = {"success": True, "entries": [{"action_type": 22}], "count": 1}
    resp = client.get("/api/v1/guilds/g1/audit-logs?limit=10")
    assert resp.status_code == 200
    assert resp.json()["count"] == 1


@patch("discord_mcp.server.discord_tool", new_callable=AsyncMock)
def test_rag_ingest_endpoint(mock_tool):
    mock_tool.return_value = {"success": True, "ingested": 3}
    resp = client.post(
        "/api/v1/rag/ingest",
        json={
            "channel_id": "c1",
            "limit": 10,
            "guild_name": "Test",
            "channel_name": "general",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["ingested"] == 3


@patch("discord_mcp.server.discord_tool", new_callable=AsyncMock)
def test_list_webhooks_endpoint(mock_tool):
    mock_tool.return_value = {"success": True, "webhooks": [{"id": "w1"}], "count": 1}
    resp = client.get("/api/v1/channels/c1/webhooks")
    assert resp.status_code == 200
