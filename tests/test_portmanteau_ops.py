"""httpx-mocked tests for portmanteau ops: moderation, roles, webhooks, audit, channels."""

from unittest.mock import AsyncMock, patch

import pytest

from discord_mcp.portmanteau import discord_tool
from tests.helpers import discord_response


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


@pytest.mark.asyncio
async def test_delete_channel_success():
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(204, method="DELETE"),
    ):
        out = await discord_tool(operation="delete_channel", channel_id="c1")
    assert out["success"] is True
    assert out["channel_id"] == "c1"


@pytest.mark.asyncio
async def test_delete_channel_missing_id():
    out = await discord_tool(operation="delete_channel")
    assert out["success"] is False
    assert "requires channel_id" in out["error"]


@pytest.mark.asyncio
async def test_delete_channel_api_error():
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(403, method="DELETE"),
    ):
        out = await discord_tool(operation="delete_channel", channel_id="c1")
    assert out["success"] is False
    assert "403" in out["error"]


@pytest.mark.asyncio
async def test_get_channel_success():
    body = {"id": "c1", "name": "fleet-freecad", "type": 0, "parent_id": "cat1", "topic": "hi"}
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(200, json_body=body),
    ):
        out = await discord_tool(operation="get_channel", channel_id="c1")
    assert out["success"] is True
    assert out["channel"]["name"] == "fleet-freecad"
    assert out["channel"]["parent_id"] == "cat1"


@pytest.mark.asyncio
async def test_update_channel_requires_field():
    out = await discord_tool(operation="update_channel", channel_id="c1")
    assert out["success"] is False
    assert "at least one field" in out["error"]


@pytest.mark.asyncio
async def test_update_channel_moves_to_category():
    body = {"id": "c1", "name": "fleet-freecad", "type": 0, "parent_id": "cat1"}
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(200, json_body=body, method="PATCH"),
    ) as mocked:
        out = await discord_tool(operation="update_channel", channel_id="c1", parent_id="cat1")
    assert out["success"] is True
    assert out["channel"]["parent_id"] == "cat1"
    args = mocked.call_args.args
    assert args[1] == "PATCH"
    assert args[2] == "https://discord.com/api/v10/channels/c1"


@pytest.mark.asyncio
async def test_update_guild_requires_field():
    out = await discord_tool(operation="update_guild", guild_id="g1")
    assert out["success"] is False
    assert "at least one field" in out["error"]


@pytest.mark.asyncio
async def test_update_guild_success():
    body = {"id": "g1", "name": "New Name", "description": "desc"}
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(200, json_body=body, method="PATCH"),
    ):
        out = await discord_tool(operation="update_guild", guild_id="g1", name="New Name")
    assert out["success"] is True
    assert out["name"] == "New Name"


@pytest.mark.asyncio
async def test_pin_message_success():
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(204, method="PUT"),
    ):
        out = await discord_tool(operation="pin_message", channel_id="c1", message_id="m1")
    assert out["success"] is True
    assert out["pinned"] is True


@pytest.mark.asyncio
async def test_unpin_message_missing_id():
    out = await discord_tool(operation="unpin_message", channel_id="c1")
    assert out["success"] is False
    assert "requires channel_id and message_id" in out["error"]


@pytest.mark.asyncio
async def test_get_pinned_messages_success():
    body = [{"id": "m1", "author": {"username": "bot"}, "content": "hello"}]
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(200, json_body=body),
    ):
        out = await discord_tool(operation="get_pinned_messages", channel_id="c1")
    assert out["success"] is True
    assert out["count"] == 1
    assert out["messages"][0]["id"] == "m1"


@pytest.mark.asyncio
async def test_create_thread_success():
    body = {"id": "t1", "name": "AlphaProof", "parent_id": "c1", "type": 11}
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(201, json_body=body, method="POST"),
    ):
        out = await discord_tool(operation="create_thread", channel_id="c1", name="AlphaProof")
    assert out["success"] is True
    assert out["thread_id"] == "t1"
    assert out["type"] == 11


@pytest.mark.asyncio
async def test_create_thread_from_message():
    body = {"id": "t2", "name": "thread", "parent_id": "c1", "type": 11}
    with patch(
        "discord_mcp.portmanteau._discord_request",
        new_callable=AsyncMock,
        return_value=discord_response(201, json_body=body, method="POST"),
    ) as mocked:
        out = await discord_tool(operation="create_thread", channel_id="c1", name="thread", message_id="m1")
    assert out["success"] is True
    assert "/messages/m1/threads" in mocked.call_args.args[2]
