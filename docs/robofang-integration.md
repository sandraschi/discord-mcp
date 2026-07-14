# Integrating discord-mcp with robofang

The discord-mcp **Message Watcher** listens for inbound Discord messages (Gateway WebSocket or REST poll) and POSTs JSON to robofang when someone sends a message in a watched channel. robofang can trigger TTS alerts, desk lights, hands gestures, or dashboard notifications — same pattern as email-mcp's Mail Watcher.

## Prerequisites

- robofang running (typically port **10956**)
- discord-mcp backend running (port **10756**)
- Bot token with **Message Content Intent** enabled (Developer Portal → Bot → Privileged Gateway Intents)
- Channel ID(s) to watch

## Quick setup

### 1. robofang alert endpoint

```
http://127.0.0.1:10956/api/alerts
```

### 2. Start the message watcher

**Dashboard:** Comms → Message Watcher → enter webhook URL and channel IDs → Start.

**REST:**

```powershell
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:10756/api/v1/comms/watcher/start" `
  -ContentType "application/json" `
  -Body '{"mode":"gateway","webhook_url":"http://127.0.0.1:10956/api/alerts","channels":[{"channel_id":"YOUR_CHANNEL_ID"}]}'
```

**MCP tool:**

```
start_message_watcher_tool(
  mode="gateway",
  webhook_url="http://127.0.0.1:10956/api/alerts",
  channels='[{"channel_id":"YOUR_CHANNEL_ID"}]'
)
```

### 3. Test

Send a message in the watched Discord channel. robofang should receive a webhook within seconds (gateway mode) or within the poll interval (poll mode).

## Webhook payload (what robofang receives)

```json
{
  "event": "new_discord_message",
  "source": "discord-mcp",
  "guild_id": "123456789",
  "channel_id": "987654321",
  "count": 1,
  "messages": [
    {
      "id": "111222333",
      "author": "sandra",
      "author_id": "444555666",
      "content": "Can you check the build?"
    }
  ],
  "timestamp": 1747234567.89
}
```

## What robofang can do

| Capability | Example |
|-----------|---------|
| **TTS** | "New Discord from sandra: Can you check the build?" |
| **Desk lights** | Flash blue for Discord vs red for email |
| **Dashboard** | Show latest comms lane activity |
| **Fleet-agent** | Trigger workflow on `new_discord_message` |

## Auto-reply (optional)

Enable a simple in-channel acknowledgment while an agent processes the message:

```powershell
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:10756/api/v1/comms/watcher/start" `
  -ContentType "application/json" `
  -Body '{"mode":"gateway","webhook_url":"http://127.0.0.1:10956/api/alerts","channels":[{"channel_id":"YOUR_CHANNEL_ID"}],"auto_reply":true,"auto_reply_template":"Thanks {author} — on it."}'
```

For full agentic replies, use `discord_agentic_workflow` from your MCP host when robofang or fleet-agent receives the webhook.

## Environment autostart

```env
DISCORD_COMMS_AUTOSTART=1
DISCORD_COMMS_CHANNELS=987654321,111222333
DISCORD_COMMS_WEBHOOK_URL=http://127.0.0.1:10956/api/alerts
DISCORD_COMMS_MODE=gateway
DISCORD_COMMS_AUTO_REPLY=0
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Watcher starts but no events | Wrong channel ID; bot lacks channel access |
| Gateway connects, no content | Enable **Message Content Intent** in Developer Portal |
| Webhook 404 | Check robofang port in fleet-registry |
| Bot replies to itself | Bot messages are ignored by design |

See also: [comms-watcher.md](./comms-watcher.md)
