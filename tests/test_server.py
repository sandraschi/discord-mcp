"""Tests for server module — REST API endpoints."""

import pytest
from fastapi.testclient import TestClient

from discord_mcp.server import app

client = TestClient(app)


def test_health_endpoint():
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "discord-mcp"
    assert "token_set" in body
    assert "rate_limit" in body
    assert "sampling" in body


def test_meta_endpoint():
    resp = client.get("/api/v1/meta")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "discord-mcp"
    assert "tools" in body
    assert "discord" in body["tools"]
    assert "prompts" in body
    assert "resources" in body


def test_skills_endpoint():
    resp = client.get("/api/v1/skills")
    assert resp.status_code == 200
    body = resp.json()
    assert "skills" in body


@pytest.mark.xfail(reason="FastMCP /mcp endpoint requires lifespan that TestClient does not fully initialize")
def test_mcp_endpoint():
    resp = client.get("/mcp")
    assert resp.status_code in (200, 406, 307)


def test_health_mcp_path_field():
    resp = client.get("/api/v1/health")
    body = resp.json()
    assert body["mcp_http_path"] == "/mcp"
