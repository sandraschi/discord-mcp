"""Tests for rate limiting module."""

import time

import pytest

from discord_mcp.rate_limit import (
    _prune_old,
    check_create_channel,
    check_create_invite,
    check_send_message,
    get_rate_limit_config,
    record_create_channel,
    record_create_invite,
    record_send_message,
)
from discord_mcp.state import _state


def _reset_state() -> None:
    """Clear global state between tests."""
    _state.clear_rate_limit_data()


def test_rate_limit_config_defaults():
    _reset_state()
    cfg = get_rate_limit_config()
    assert cfg["messages_per_minute"] == 10
    assert cfg["messages_per_channel_per_minute"] == 3
    assert cfg["channels_per_minute"] == 5
    assert cfg["invites_per_minute"] == 5
    assert cfg["max_message_length"] == 2000
    assert cfg["min_message_interval_seconds"] == 5.0


def test_prune_old():
    _reset_state()
    now = time.monotonic()
    recent = [now - 30, now - 20, now - 10]
    old = now - 120
    combined = [old, now - 30, now - 20, now - 10]
    _prune_old(combined, window=60.0)
    assert combined == recent


@pytest.mark.asyncio
async def test_check_send_message_allowed():
    _reset_state()
    allowed, err = await check_send_message("chan1", "hello")
    assert allowed is True
    assert err is None


@pytest.mark.asyncio
async def test_check_send_message_too_long():
    _reset_state()
    long_msg = "x" * 2001
    allowed, err = await check_send_message("chan1", long_msg)
    assert allowed is False
    assert "char limit" in (err or "")


@pytest.mark.asyncio
async def test_send_message_rate_limit_per_minute(monkeypatch):
    _reset_state()
    monkeypatch.setenv("DISCORD_MIN_MESSAGE_INTERVAL_SECONDS", "0")
    monkeypatch.setenv("DISCORD_RATE_LIMIT_MESSAGES_PER_MINUTE", "2")
    allowed, _ = await check_send_message("chan1", "msg1")
    assert allowed is True
    record_send_message("chan1")
    allowed, _ = await check_send_message("chan1", "msg2")
    assert allowed is True
    record_send_message("chan1")
    allowed, err = await check_send_message("chan1", "msg3")
    assert allowed is False
    assert "per minute" in (err or "")


@pytest.mark.asyncio
async def test_send_message_per_channel_rate_limit(monkeypatch):
    _reset_state()
    monkeypatch.setenv("DISCORD_MIN_MESSAGE_INTERVAL_SECONDS", "0")
    monkeypatch.setenv("DISCORD_RATE_LIMIT_MESSAGES_PER_CHANNEL_PER_MINUTE", "1")
    allowed, _ = await check_send_message("chan1", "msg1")
    assert allowed is True
    record_send_message("chan1")
    allowed, err = await check_send_message("chan1", "msg2")
    assert allowed is False
    assert "per channel" in (err or "")


@pytest.mark.asyncio
async def test_check_create_channel_allowed():
    _reset_state()
    allowed, err = await check_create_channel()
    assert allowed is True
    assert err is None


@pytest.mark.asyncio
async def test_check_create_channel_rate_limit(monkeypatch):
    _reset_state()
    monkeypatch.setenv("DISCORD_RATE_LIMIT_CHANNELS_PER_MINUTE", "2")
    assert (await check_create_channel())[0] is True
    record_create_channel()
    assert (await check_create_channel())[0] is True
    record_create_channel()
    allowed, err = await check_create_channel()
    assert allowed is False
    assert "channels" in (err or "")


@pytest.mark.asyncio
async def test_check_create_invite_allowed():
    _reset_state()
    allowed, err = await check_create_invite()
    assert allowed is True
    assert err is None


@pytest.mark.asyncio
async def test_check_create_invite_rate_limit(monkeypatch):
    _reset_state()
    monkeypatch.setenv("DISCORD_RATE_LIMIT_INVITES_PER_MINUTE", "1")
    assert (await check_create_invite())[0] is True
    record_create_invite()
    allowed, err = await check_create_invite()
    assert allowed is False
    assert "invites" in (err or "")
