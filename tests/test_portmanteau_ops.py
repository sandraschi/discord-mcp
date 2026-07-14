"""httpx-mocked tests for moderation, roles, webhooks, and audit portmanteau ops."""

from unittest.mock import AsyncMock, patch

import pytest

from discord_mcp.portmanteau import discord_tool
from tests.helpers import discord_response


@pytest.fixture(autouse=True)
def _token(monkeypatch):
    monkeypatch.setenv("DISCORD_TOKEN", "test-token")


@pytest.mark.asyncio
async def test_ban_member_success():
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(204, method="PUT"),
    ):
        out = await discord_tool(operation="ban_member", guild_id="g1", user_id="u1", reason="spam")
    assert out["success"] is True
    assert out["banned"] is True


@pytest.mark.asyncio
async def test_list_bans_success():
    body = [{"user": {"id": "u1", "username": "bad"}, "reason": "spam"}]
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(200, json_body=body),
    ):
        out = await discord_tool(operation="list_bans", guild_id="g1", limit=10)
    assert out["success"] is True
    assert out["count"] == 1
    assert out["bans"][0]["user_id"] == "u1"


@pytest.mark.asyncio
async def test_kick_member_forbidden():
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(403, method="DELETE"),
    ):
        out = await discord_tool(operation="kick_member", guild_id="g1", user_id="u1")
    assert out["success"] is False
    assert "KICK_MEMBERS" in out["error"]


@pytest.mark.asyncio
async def test_timeout_member_requires_timestamp():
    out = await discord_tool(operation="timeout_member", guild_id="g1", user_id="u1")
    assert out["success"] is False
    assert "communication_disabled_until" in out["error"]


@pytest.mark.asyncio
async def test_list_roles_success():
    body = [{"id": "r1", "name": "Mod", "color": 0, "position": 1, "permissions": "0", "managed": False}]
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(200, json_body=body),
    ):
        out = await discord_tool(operation="list_roles", guild_id="g1")
    assert out["success"] is True
    assert out["roles"][0]["name"] == "Mod"


@pytest.mark.asyncio
async def test_create_role_success():
    body = {"id": "r2", "name": "Helper", "color": 0}
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(201, json_body=body, method="POST"),
    ):
        out = await discord_tool(operation="create_role", guild_id="g1", name="Helper")
    assert out["success"] is True
    assert out["role_id"] == "r2"


@pytest.mark.asyncio
async def test_assign_role_success():
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(204, method="PUT"),
    ):
        out = await discord_tool(operation="assign_role", guild_id="g1", user_id="u1", role_id="r1")
    assert out["success"] is True
    assert out["assigned"] is True


@pytest.mark.asyncio
async def test_list_webhooks_success():
    body = [{"id": "w1", "name": "Hook", "channel_id": "c1", "guild_id": "g1", "token": "tok"}]
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(200, json_body=body),
    ):
        out = await discord_tool(operation="list_webhooks", channel_id="c1")
    assert out["success"] is True
    assert out["webhooks"][0]["id"] == "w1"


@pytest.mark.asyncio
async def test_create_webhook_success():
    body = {"id": "w2", "name": "Alerts", "token": "secret"}
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(201, json_body=body, method="POST"),
    ):
        out = await discord_tool(operation="create_webhook", channel_id="c1", webhook_name="Alerts")
    assert out["success"] is True
    assert out["webhook_id"] == "w2"


@pytest.mark.asyncio
async def test_get_audit_log_success():
    body = {
        "audit_log_entries": [
            {
                "id": "e1",
                "action_type": 22,
                "user_id": "mod1",
                "target_id": "u1",
                "reason": "spam",
            }
        ]
    }
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(200, json_body=body),
    ):
        out = await discord_tool(operation="get_audit_log", guild_id="g1", limit=5)
    assert out["success"] is True
    assert out["entries"][0]["action_type"] == 22


@pytest.mark.asyncio
async def test_destructive_preflight_blocks_ban(monkeypatch):
    monkeypatch.setenv("DISCORD_DEEPFANG_PREFLIGHT", "1")
    monkeypatch.delenv("DISCORD_DEEPFANG_CONFIRM", raising=False)
    out = await discord_tool(operation="ban_member", guild_id="g1", user_id="u1")
    assert out["success"] is False
    assert out.get("preflight") is True


@pytest.mark.asyncio
async def test_get_messages_sanitizes_and_wraps_for_mcp(monkeypatch):
    from types import SimpleNamespace

    body = [{"id": "m1", "author": {"username": "alice\u200b"}, "content": "hello\u200bworld"}]
    ctx = SimpleNamespace(correlation_id="test")
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(200, json_body=body),
    ):
        out = await discord_tool(ctx=ctx, operation="get_messages", channel_id="c1", limit=5)
    assert out["success"] is True
    assert "\u200b" not in out["messages"][0]["content"]
    assert "UNTRUSTED EXTERNAL DATA" in out["messages"][0]["content"]
