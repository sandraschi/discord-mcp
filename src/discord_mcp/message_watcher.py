"""Discord message watcher — Gateway WebSocket or REST polling with outbound webhooks.

Detects inbound Discord messages and POSTs JSON to robofang, fleet-agent, or any listener.
Optional auto-reply in-channel (template or echo).
Optional active-window schedule: processing (webhook, auto-reply, RAG, rules) only
happens inside configured time windows - the gateway stays connected outside them.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime
from typing import Any

import httpx

from .portmanteau import _discord_request, _resolve_discord_token, discord_tool
from .sanitize import sanitize_text

logger = logging.getLogger("discord-mcp.message_watcher")

_watcher_task: asyncio.Task | None = None
_watcher_config: dict[str, Any] = {}

# GUILDS | GUILD_MESSAGES | MESSAGE_CONTENT
_GATEWAY_INTENTS = (1 << 0) | (1 << 9) | (1 << 15)

_DEFAULT_SCHEDULE_TZ = "Europe/Vienna"


def _day_matches(days: str, weekday: int) -> bool:
    """Match a days spec ('wd', 'we', 'all', or '0,2,4' with Monday=0) against a weekday."""
    spec = (days or "all").strip().lower()
    if spec in ("all", ""):
        return True
    if spec == "wd":
        return weekday < 5
    if spec == "we":
        return weekday >= 5
    try:
        return str(weekday) in {d.strip() for d in spec.split(",") if d.strip()}
    except ValueError:
        return True


def _time_in_window(start: str, end: str, now: datetime) -> bool:
    """HH:MM window check; end <= start wraps overnight."""
    h, m = now.hour, now.minute
    cur = h * 60 + m

    def _parse(value: str) -> int:
        hh, mm = [*value.split(":"), "0"][:2]
        return int(hh) * 60 + int(mm)

    s, e = _parse(start), _parse(end)
    if e <= s:
        return cur >= s or cur < e
    return s <= cur < e


def _in_active_window(config: dict[str, Any], now: datetime | None = None) -> bool:
    """True when the watcher should process messages now.

    No schedule configured -> always active (back-compat). Schedule shape:
    {"tz": "Europe/Vienna", "windows": [{"days": "wd", "start": "09:00", "end": "17:30"}]}
    """
    schedule = config.get("schedule")
    if not schedule:
        return True
    windows = schedule.get("windows") or []
    if not windows:
        return True
    try:
        from zoneinfo import ZoneInfo

        tz_name = schedule.get("tz") or _DEFAULT_SCHEDULE_TZ
        now = now or datetime.now(ZoneInfo(tz_name))
    except Exception:
        now = now or datetime.now()
    return any(
        _day_matches(str(w.get("days", "all")), now.weekday())
        and _time_in_window(str(w.get("start", "00:00")), str(w.get("end", "23:59")), now)
        for w in windows
    )


def _channel_ids(config: dict[str, Any]) -> set[str]:
    channels = config.get("channels") or []
    return {str(c.get("channel_id", "")).strip() for c in channels if c.get("channel_id")}


def _normalize_message(raw: dict[str, Any]) -> dict[str, Any]:
    author = raw.get("author") or {}
    return {
        "id": str(raw.get("id", "")),
        "channel_id": str(raw.get("channel_id", "")),
        "guild_id": str(raw.get("guild_id") or (raw.get("guild") or {}).get("id") or ""),
        "author": sanitize_text(author.get("username", "")),
        "author_id": str(author.get("id", "")),
        "content": sanitize_text(raw.get("content") or "")[:2000],
        "timestamp": raw.get("timestamp"),
    }


async def _fire_webhook(webhook_url: str, message: dict[str, Any]) -> None:
    if not webhook_url.strip():
        return
    payload = {
        "event": "new_discord_message",
        "source": "discord-mcp",
        "guild_id": message.get("guild_id"),
        "channel_id": message.get("channel_id"),
        "count": 1,
        "messages": [
            {
                "id": message.get("id"),
                "author": message.get("author"),
                "author_id": message.get("author_id"),
                "content": message.get("content", "")[:500],
            }
        ],
        "timestamp": time.time(),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code >= 400:
                logger.warning("Webhook POST %s returned %s", webhook_url, resp.status_code)
    except Exception as exc:
        logger.warning("Webhook POST failed to %s: %s", webhook_url, exc)


async def _maybe_auto_reply(config: dict[str, Any], message: dict[str, Any]) -> None:
    if not config.get("auto_reply"):
        return
    template = (config.get("auto_reply_template") or "Thanks {author} — received your message.").strip()
    reply = (
        template.replace("{author}", message.get("author") or "there")
        .replace("{content}", (message.get("content") or "")[:500])
        .replace("{channel_id}", message.get("channel_id") or "")
    )
    if not reply:
        return
    out = await discord_tool(
        operation="send_message",
        channel_id=message["channel_id"],
        content=reply[:2000],
    )
    if not out.get("success"):
        logger.warning("Auto-reply failed: %s", out.get("error"))


async def _dispatch_inbound(config: dict[str, Any], raw_message: dict[str, Any]) -> None:
    if not _in_active_window(config):
        logger.debug("Message outside active schedule window - skipping dispatch")
        return

    author = raw_message.get("author") or {}
    if author.get("bot"):
        return

    message = _normalize_message(raw_message)
    if not message["id"] or not message["channel_id"]:
        return

    watch = _channel_ids(config)
    if watch and message["channel_id"] not in watch:
        return

    logger.info(
        "Inbound message %s in channel %s from %s",
        message["id"],
        message["channel_id"],
        message.get("author"),
    )
    await _fire_webhook(config.get("webhook_url", ""), message)
    await _maybe_auto_reply(config, message)

    try:
        from .rules import evaluate_rules

        await evaluate_rules(message)
    except Exception as e:
        logger.error("Rules evaluation failed: %s", e)

    try:
        from .slack_bridge import forward_to_slack

        await forward_to_slack(message.get("channel_id"), message)
    except Exception as e:
        logger.error("Slack forwarding failed: %s", e)

    try:
        from .analytics import tracker

        tracker.record_message()
    except Exception as exc:
        logger.debug("Failed to record analytics: %s", exc)

    if config.get("auto_rag"):
        try:
            from .rag import ingest_messages

            msg_dict = {
                "id": message.get("id"),
                "author": message.get("author"),
                "content": message.get("content"),
                "timestamp": message.get("timestamp"),
            }
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                ingest_messages,
                [msg_dict],
                "",  # guild_name
                "",  # channel_name
                message.get("channel_id"),
                message.get("guild_id"),
            )
        except Exception as e:
            logger.error("Auto RAG ingestion failed: %s", e)


async def _poll_loop(config: dict[str, Any]) -> None:
    interval_s = max(10, int(config.get("interval", 30)))
    known: dict[str, set[str]] = {}
    channels = config.get("channels") or []
    logger.info("Message watcher poll mode started (interval=%ss, channels=%d)", interval_s, len(channels))

    while True:
        for ch in channels:
            channel_id = str(ch.get("channel_id", "")).strip()
            if not channel_id:
                continue
            try:
                out = await discord_tool(operation="get_messages", channel_id=channel_id, limit=25)
                if not out.get("success"):
                    logger.debug("Poll get_messages failed for %s: %s", channel_id, out.get("error"))
                    continue
                msgs = out.get("messages") or []
                ids = {str(m.get("id")) for m in msgs if m.get("id")}
                key = channel_id
                if key not in known:
                    known[key] = ids
                    continue
                fresh_ids = ids - known[key]
                if fresh_ids:
                    for m in msgs:
                        if str(m.get("id")) in fresh_ids:
                            synthetic = {
                                "id": m.get("id"),
                                "channel_id": channel_id,
                                "guild_id": ch.get("guild_id", ""),
                                "author": {"username": m.get("author"), "id": m.get("author_id"), "bot": False},
                                "content": m.get("content"),
                                "timestamp": m.get("timestamp"),
                            }
                            await _dispatch_inbound(config, synthetic)
                known[key] = ids
            except Exception as exc:
                logger.warning("Poll failed for channel %s: %s", channel_id, exc)
        await asyncio.sleep(interval_s)


async def _gateway_loop(config: dict[str, Any]) -> None:
    token = _resolve_discord_token()
    if not token:
        logger.error("Gateway watcher: DISCORD_TOKEN not set")
        return

    try:
        import websockets
    except ImportError:
        logger.error("Gateway watcher requires websockets package; use mode=poll or uv sync")
        return

    logger.info("Message watcher gateway mode starting (channels=%d)", len(config.get("channels") or []))

    while True:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await _discord_request(
                    client,
                    "GET",
                    "https://discord.com/api/v10/gateway/bot",
                    headers={"Authorization": f"Bot {token}"},
                )
                if r.status_code != 200:
                    logger.warning("Gateway bot info failed: %s", r.status_code)
                    await asyncio.sleep(15)
                    continue
                gateway_url = r.json().get("url")
            if not gateway_url:
                await asyncio.sleep(15)
                continue

            async with websockets.connect(f"{gateway_url}/?v=10&encoding=json", max_size=2**22) as ws:
                seq_box: list[int | None] = [None]
                heartbeat_task: asyncio.Task | None = None

                async def heartbeat_loop(interval: float, seq: list[int | None]) -> None:
                    while True:
                        await asyncio.sleep(interval)
                        payload: dict[str, Any] = {"op": 1}
                        if seq[0] is not None:
                            payload["d"] = seq[0]
                        await ws.send(json.dumps(payload))

                async for raw in ws:
                    data = json.loads(raw)
                    op = data.get("op")
                    t = data.get("t")
                    d = data.get("d")
                    if data.get("s") is not None:
                        seq_box[0] = data["s"]

                    if op == 10 and isinstance(d, dict):
                        heartbeat_interval = d.get("heartbeat_interval", 45000) / 1000.0
                        if heartbeat_task:
                            heartbeat_task.cancel()
                        heartbeat_task = asyncio.create_task(heartbeat_loop(heartbeat_interval or 30.0, seq_box))
                        identify = {
                            "op": 2,
                            "d": {
                                "token": f"Bot {token}",
                                "intents": _GATEWAY_INTENTS,
                                "properties": {
                                    "$os": "windows",
                                    "$browser": "discord-mcp",
                                    "$device": "discord-mcp",
                                },
                            },
                        }
                        await ws.send(json.dumps(identify))
                    elif op == 7:
                        logger.info("Gateway requested reconnect")
                        break
                    elif op == 9:
                        logger.warning("Gateway invalid session")
                        break
                    elif t == "MESSAGE_CREATE" and isinstance(d, dict):
                        await _dispatch_inbound(config, d)

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Gateway loop error: %s — reconnecting in 10s", exc)
            await asyncio.sleep(10)


async def _run_watcher(config: dict[str, Any]) -> None:
    mode = (config.get("mode") or "gateway").lower()
    if mode == "poll":
        await _poll_loop(config)
    else:
        await _gateway_loop(config)


def start_message_watcher(
    *,
    mode: str = "gateway",
    interval: int = 30,
    webhook_url: str = "",
    channels: list[dict[str, Any]] | None = None,
    auto_reply: bool = False,
    auto_reply_template: str = "",
    auto_rag: bool = False,
    schedule: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Start background Discord message watcher."""
    global _watcher_task, _watcher_config

    if _watcher_task is not None and not _watcher_task.done():
        return {
            "running": True,
            "message": "Message watcher already running",
            "config": _watcher_config,
        }

    if not _resolve_discord_token():
        return {"running": False, "error": "DISCORD_TOKEN not set"}

    chans = channels or []
    if not chans:
        return {"running": False, "error": "At least one channel_id required in channels list"}

    _watcher_config = {
        "mode": mode,
        "interval": max(10, min(interval, 3600)),
        "webhook_url": webhook_url.strip(),
        "channels": chans,
        "auto_reply": auto_reply,
        "auto_reply_template": auto_reply_template,
        "auto_rag": auto_rag,
    }
    if schedule and schedule.get("windows"):
        _watcher_config["schedule"] = schedule
    loop = asyncio.get_event_loop()
    _watcher_task = loop.create_task(_run_watcher(_watcher_config))
    return {
        "running": True,
        "message": f"Message watcher started (mode={mode})",
        "config": _watcher_config,
    }


def stop_message_watcher() -> dict[str, Any]:
    """Stop background message watcher."""
    global _watcher_task
    if _watcher_task is None or _watcher_task.done():
        _watcher_task = None
        return {"running": False, "message": "No message watcher running"}
    _watcher_task.cancel()
    _watcher_task = None
    return {"running": False, "message": "Message watcher stopped"}


def message_watcher_status() -> dict[str, Any]:
    """Return watcher running state and config."""
    running = _watcher_task is not None and not _watcher_task.done()
    return {
        "running": running,
        "config": _watcher_config if running else None,
    }


async def maybe_autostart_from_env() -> None:
    """Start watcher on server boot when DISCORD_COMMS_AUTOSTART=1."""
    flag = os.environ.get("DISCORD_COMMS_AUTOSTART", "").strip().lower()
    if flag not in ("1", "true", "yes"):
        return
    raw_channels = os.environ.get("DISCORD_COMMS_CHANNELS", "").strip()
    if not raw_channels:
        logger.warning("DISCORD_COMMS_AUTOSTART set but DISCORD_COMMS_CHANNELS empty")
        return
    channels = [{"channel_id": c.strip()} for c in raw_channels.split(",") if c.strip()]
    start_message_watcher(
        mode=os.environ.get("DISCORD_COMMS_MODE", "gateway"),
        interval=int(os.environ.get("DISCORD_COMMS_INTERVAL", "30")),
        webhook_url=os.environ.get("DISCORD_COMMS_WEBHOOK_URL", ""),
        channels=channels,
        auto_reply=os.environ.get("DISCORD_COMMS_AUTO_REPLY", "").lower() in ("1", "true", "yes"),
        auto_reply_template=os.environ.get("DISCORD_COMMS_AUTO_REPLY_TEMPLATE", ""),
        auto_rag=os.environ.get("DISCORD_COMMS_AUTO_RAG", "").lower() in ("1", "true", "yes"),
    )
    logger.info("Message watcher autostarted from environment")
