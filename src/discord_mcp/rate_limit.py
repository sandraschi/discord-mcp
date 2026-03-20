"""Rate limiting and safety checks for write operations (send_message, create_channel)."""
import asyncio
import logging
import os
import time
from typing import Any

from .state import _state

logger = logging.getLogger("discord-mcp.rate_limit")

WINDOW_SECONDS = 60.0


def get_rate_limit_config() -> dict[str, Any]:
    return {
        "messages_per_minute": int(os.environ.get("DISCORD_RATE_LIMIT_MESSAGES_PER_MINUTE", "10")),
        "messages_per_channel_per_minute": int(
            os.environ.get("DISCORD_RATE_LIMIT_MESSAGES_PER_CHANNEL_PER_MINUTE", "3")
        ),
        "channels_per_minute": int(os.environ.get("DISCORD_RATE_LIMIT_CHANNELS_PER_MINUTE", "5")),
        "invites_per_minute": int(os.environ.get("DISCORD_RATE_LIMIT_INVITES_PER_MINUTE", "5")),
        "max_message_length": int(os.environ.get("DISCORD_MAX_MESSAGE_LENGTH", "2000")),
        "min_message_interval_seconds": float(
            os.environ.get("DISCORD_MIN_MESSAGE_INTERVAL_SECONDS", "5.0")
        ),
    }


def _ensure_rate_limit_state() -> None:
    if "rate_limit_lock" not in _state:
        _state["rate_limit_lock"] = asyncio.Lock()
    if "message_timestamps" not in _state:
        _state["message_timestamps"] = []
    if "channel_message_timestamps" not in _state:
        _state["channel_message_timestamps"] = {}
    if "create_channel_timestamps" not in _state:
        _state["create_channel_timestamps"] = []
    if "create_invite_timestamps" not in _state:
        _state["create_invite_timestamps"] = []
    if "last_message_at" not in _state:
        _state["last_message_at"] = 0.0


def _prune_old(timestamps: list[float], window: float = WINDOW_SECONDS) -> None:
    now = time.monotonic()
    cutoff = now - window
    while timestamps and timestamps[0] < cutoff:
        timestamps.pop(0)


async def check_send_message(channel_id: str, content: str) -> tuple[bool, str | None]:
    """Return (True, None) if allowed, else (False, error_message)."""
    _ensure_rate_limit_state()
    cfg = get_rate_limit_config()
    max_len = min(cfg["max_message_length"], 2000)
    if len(content) > max_len:
        return False, f"Message length {len(content)} exceeds limit {max_len}. Set DISCORD_MAX_MESSAGE_LENGTH to override (max 2000)."
    async with _state["rate_limit_lock"]:
        now = time.monotonic()
        msg_ts: list[float] = _state["message_timestamps"]
        chan_ts: dict[str, list[float]] = _state["channel_message_timestamps"]
        last_at: float = _state["last_message_at"]
        _prune_old(msg_ts)
        if channel_id not in chan_ts:
            chan_ts[channel_id] = []
        _prune_old(chan_ts[channel_id])
        interval = cfg["min_message_interval_seconds"]
        if last_at > 0 and (now - last_at) < interval:
            return False, f"Rate limit: wait {interval:.0f}s between messages. Set DISCORD_MIN_MESSAGE_INTERVAL_SECONDS to override."
        if len(msg_ts) >= cfg["messages_per_minute"]:
            return False, f"Rate limit: max {cfg['messages_per_minute']} messages per minute. Set DISCORD_RATE_LIMIT_MESSAGES_PER_MINUTE to override."
        if len(chan_ts[channel_id]) >= cfg["messages_per_channel_per_minute"]:
            return False, f"Rate limit: max {cfg['messages_per_channel_per_minute']} messages per channel per minute. Set DISCORD_RATE_LIMIT_MESSAGES_PER_CHANNEL_PER_MINUTE to override."
        return True, None


def record_send_message(channel_id: str) -> None:
    """Call after a successful send_message."""
    _ensure_rate_limit_state()
    now = time.monotonic()
    _state["message_timestamps"].append(now)
    if channel_id not in _state["channel_message_timestamps"]:
        _state["channel_message_timestamps"][channel_id] = []
    _state["channel_message_timestamps"][channel_id].append(now)
    _state["last_message_at"] = now
    logger.info("Recorded send_message for rate limit", extra={"channel_id": channel_id})


async def check_create_channel() -> tuple[bool, str | None]:
    """Return (True, None) if allowed, else (False, error_message)."""
    _ensure_rate_limit_state()
    cfg = get_rate_limit_config()
    async with _state["rate_limit_lock"]:
        ts: list[float] = _state["create_channel_timestamps"]
        _prune_old(ts)
        if len(ts) >= cfg["channels_per_minute"]:
            return False, f"Rate limit: max {cfg['channels_per_minute']} channels created per minute. Set DISCORD_RATE_LIMIT_CHANNELS_PER_MINUTE to override."
        return True, None


def record_create_channel() -> None:
    """Call after a successful create_channel."""
    _ensure_rate_limit_state()
    _state["create_channel_timestamps"].append(time.monotonic())
    logger.info("Recorded create_channel for rate limit")


async def check_create_invite() -> tuple[bool, str | None]:
    """Return (True, None) if allowed, else (False, error_message)."""
    _ensure_rate_limit_state()
    cfg = get_rate_limit_config()
    async with _state["rate_limit_lock"]:
        ts: list[float] = _state["create_invite_timestamps"]
        _prune_old(ts)
        if len(ts) >= cfg["invites_per_minute"]:
            return False, (
                f"Rate limit: max {cfg['invites_per_minute']} invites per minute. "
                "Set DISCORD_RATE_LIMIT_INVITES_PER_MINUTE to override."
            )
        return True, None


def record_create_invite() -> None:
    """Call after a successful create_invite."""
    _ensure_rate_limit_state()
    _state["create_invite_timestamps"].append(time.monotonic())
    logger.info("Recorded create_invite for rate limit")
