"""REST tests for comms watcher endpoints."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from discord_mcp.server import app

client = TestClient(app)


@patch("discord_mcp.server.start_message_watcher")
def test_comms_watcher_start(mock_start):
    mock_start.return_value = {"running": True, "message": "started"}
    resp = client.post(
        "/api/v1/comms/watcher/start",
        json={"channels": [{"channel_id": "c1"}], "webhook_url": "http://127.0.0.1:10956/api/alerts"},
    )
    assert resp.status_code == 200
    assert resp.json()["running"] is True


@patch("discord_mcp.server.stop_message_watcher")
def test_comms_watcher_stop(mock_stop):
    mock_stop.return_value = {"running": False, "message": "stopped"}
    resp = client.post("/api/v1/comms/watcher/stop")
    assert resp.status_code == 200


def test_comms_watcher_status():
    resp = client.get("/api/v1/comms/watcher/status")
    assert resp.status_code == 200
    assert "running" in resp.json()
