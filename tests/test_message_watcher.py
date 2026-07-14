"""Tests for comms lane message watcher."""

from unittest.mock import AsyncMock, patch

import pytest

from discord_mcp.message_watcher import (
    _dispatch_inbound,
    _fire_webhook,
    message_watcher_status,
    start_message_watcher,
    stop_message_watcher,
)


@pytest.fixture
def watcher_config():
    return {
        "webhook_url": "http://127.0.0.1:10956/api/alerts",
        "channels": [{"channel_id": "c1"}],
        "auto_reply": False,
    }


@pytest.mark.asyncio
async def test_fire_webhook_posts_payload(watcher_config):
    message = {
        "id": "m1",
        "channel_id": "c1",
        "guild_id": "g1",
        "author": "alice",
        "author_id": "u1",
        "content": "hello",
    }
    with patch("discord_mcp.message_watcher.httpx.AsyncClient") as mock_client:
        instance = mock_client.return_value.__aenter__.return_value
        instance.post = AsyncMock(return_value=type("R", (), {"status_code": 200})())
        await _fire_webhook(watcher_config["webhook_url"], message)
        instance.post.assert_awaited_once()
        payload = instance.post.await_args.kwargs["json"]
        assert payload["event"] == "new_discord_message"
        assert payload["messages"][0]["author"] == "alice"


@pytest.mark.asyncio
async def test_dispatch_skips_bot_messages(watcher_config):
    with patch("discord_mcp.message_watcher._fire_webhook", new_callable=AsyncMock) as mock_wh:
        await _dispatch_inbound(
            watcher_config,
            {"author": {"bot": True, "username": "bot"}, "id": "1", "channel_id": "c1"},
        )
        mock_wh.assert_not_awaited()


@pytest.mark.asyncio
async def test_dispatch_fires_for_human_message(watcher_config):
    with (
        patch("discord_mcp.message_watcher._fire_webhook", new_callable=AsyncMock) as mock_wh,
        patch("discord_mcp.message_watcher._maybe_auto_reply", new_callable=AsyncMock) as mock_ar,
    ):
        await _dispatch_inbound(
            watcher_config,
            {
                "id": "m2",
                "channel_id": "c1",
                "guild_id": "g1",
                "author": {"username": "bob", "id": "u2", "bot": False},
                "content": "ping",
            },
        )
        mock_wh.assert_awaited_once()
        mock_ar.assert_awaited_once()


def test_start_requires_token(monkeypatch):
    monkeypatch.delenv("DISCORD_TOKEN", raising=False)
    monkeypatch.delenv("DISCORD_BOT_TOKEN", raising=False)
    out = start_message_watcher(channels=[{"channel_id": "c1"}])
    assert out["running"] is False
    assert "token" in out.get("error", "").lower()


def test_start_stop_lifecycle(monkeypatch):
    monkeypatch.setenv("DISCORD_TOKEN", "test-token")
    stop_message_watcher()

    async def _hang_forever(_config):
        import asyncio

        await asyncio.sleep(3600)

    with patch("discord_mcp.message_watcher._run_watcher", side_effect=_hang_forever):
        out = start_message_watcher(channels=[{"channel_id": "c1"}], webhook_url="http://example/alerts")
        assert out["running"] is True
        assert message_watcher_status()["running"] is True
        stop = stop_message_watcher()
        assert stop["running"] is False
