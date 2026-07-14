# Comms watcher — inbound Discord → webhook → agent

The **Message Watcher** is discord-mcp's comms lane: detect inbound Discord messages and notify external systems (robofang, fleet-agent) via HTTP POST. Optional template auto-reply keeps humans informed while an agent runs.

## Architecture

```
Discord channel
    → Gateway WebSocket (default) or REST poll
    → message_watcher._dispatch_inbound
        → POST webhook (robofang / fleet-agent)
        → optional send_message auto-reply
```

Outbound messaging (`send_message`, agentic workflow) is unchanged. The watcher adds **inbound** detection.

## Modes

| Mode | How | When to use |
|------|-----|-------------|
| **gateway** | Discord Gateway WebSocket (`MESSAGE_CREATE`) | Production — real-time, low latency |
| **poll** | REST `get_messages` on an interval | Fallback if Gateway blocked; testing without websockets |

## API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/comms/watcher/start` | Start watcher |
| POST | `/api/v1/comms/watcher/stop` | Stop watcher |
| GET | `/api/v1/comms/watcher/status` | Running state + config |

**Start body:**

```json
{
  "mode": "gateway",
  "interval": 30,
  "webhook_url": "http://127.0.0.1:10956/api/alerts",
  "channels": [{"channel_id": "123", "guild_id": "456"}],
  "auto_reply": false,
  "auto_reply_template": "Thanks {author} — received."
}
```

## MCP tools

- `start_message_watcher_tool`
- `stop_message_watcher_tool`
- `message_watcher_status_tool`

## Discord Developer Portal

For gateway mode enable:

- **Message Content Intent** (privileged)
- Bot invited to server with read/send in watched channels

## Integration docs

- [robofang-integration.md](./robofang-integration.md) — robofang TTS/lights setup
- [CONFIGURATION.md](./CONFIGURATION.md) — `DISCORD_COMMS_*` env vars

## Module

Implementation: `src/discord_mcp/message_watcher.py`
