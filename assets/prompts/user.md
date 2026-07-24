# discord-mcp User Guide

## Getting Started

### Prerequisites
1. A Discord bot token from https://discord.com/developers/applications
2. Python 3.12+ with uv installed
3. Node 20+ for the web dashboard (optional)

### Quick Start

```powershell
# Clone and install
git clone https://github.com/sandraschi/discord-mcp
cd discord-mcp
uv sync

# Set your bot token (copy .env.example to .env and edit)
# DISCORD_TOKEN=your_bot_token_here

# Start the server (stdio mode for MCP clients)
uv run python -m discord_mcp.server --mode stdio

# Or start the full stack with web dashboard
.\start.ps1
```

### MCP Client Configuration

#### Cursor
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "discord": {
      "command": "uv",
      "args": ["run", "--directory", "D:/Dev/repos/discord-mcp", "python", "-m", "discord_mcp.server"],
      "env": {
        "PYTHONPATH": "D:/Dev/repos/discord-mcp/src",
        "DISCORD_TOKEN": "your_token_here"
      }
    }
  }
}
```

#### Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "discord": {
      "command": "uv",
      "args": ["run", "--directory", "D:/Dev/repos/discord-mcp", "python", "-m", "discord_mcp.server", "--mode", "stdio"],
      "env": {
        "DISCORD_TOKEN": "your_token_here"
      }
    }
  }
}
```

## Common Workflows

### 1. List Your Servers and Channels

Start by discovering what the bot can access:
```
discord(operation="list_guilds")
```
This returns all guilds the bot is in. Pick a guild_id, then:
```
discord(operation="list_channels", guild_id="123456789")
```

### 2. Send a Message to a Channel

```
discord(operation="send_message", channel_id="987654321", content="Hello from MCP!")
```

### 3. Moderate a Server

Check recent audit log for moderation events:
```
discord(operation="get_audit_log", guild_id="123456789", limit=20)
```

Ban a spammer:
```
discord(operation="ban_member", guild_id="123456789", user_id="555555", reason="Spamming in #general")
```

List current bans:
```
discord(operation="list_bans", guild_id="123456789")
```

### 4. Manage Roles

List roles, create a new one, assign it:
```
discord(operation="list_roles", guild_id="123456789")
discord(operation="create_role", guild_id="123456789", name="Helper")
discord(operation="assign_role", guild_id="123456789", user_id="444444", role_id="333333")
```

### 5. Search Message History with RAG

Ingest recent messages from a channel:
```
discord(operation="rag_ingest", channel_id="987654321", limit=100)
```

Then search semantically:
```
discord(operation="rag_query", query_text="discussion about deployment", top_k=10)
```

### 6. Create and Manage Invites

Create a temporary invite for a friend:
```
discord(operation="create_invite", channel_id="987654321", max_age=86400, max_uses=1)
```

List active invites:
```
discord(operation="list_invites", guild_id="123456789")
```

### 7. Export Channel Messages

Export a channel conversation as formatted markdown for Notion or Obsidian:
```
discord(operation="export_messages", channel_id="987654321", limit=50)
```

### 8. Webhook Automation

Create a webhook in a channel, then execute it:
```
discord(operation="create_webhook", channel_id="987654321", name="Deploy Bot")
discord(operation="execute_webhook", webhook_id="111111", token="abc123", content="Deploy complete!")
```

### 9. Multi-Step Agentic Tasks

Describe a goal in natural language and let the server plan and execute:
```
discord_agentic_workflow(goal="Check the audit log for the last 24 hours and summarize any bans or kicks")
```

This requires a configured sampling backend (Ollama or client LLM). The server will:
1. Call `get_audit_log` to fetch entries
2. Process the results
3. Present a structured summary

## Using the Web Dashboard

The web dashboard runs on http://127.0.0.1:10757 when you start the full stack.

### Pages
- Dashboard — Server overview, guild count, bot token status, sampling status
- Guilds — Browse guilds the bot can access
- Channels — List channels, create/delete channels
- Messages — Read messages, export as markdown
- Members — List members (requires GUILD_MEMBERS intent)
- Roles — List, create, delete, assign roles
- Invites — Create invites, list active invites
- Bans — List and manage bans
- Webhooks — Create, list, delete webhooks
- Audit Log — View moderation audit trail
- RAG — Ingest messages and run semantic search
- Chat — LLM chat interface (requires Ollama)
- Comms — Inbound message watcher configuration
- Tools — Dynamic tool discovery from the MCP server
- Stats — Analytics and usage statistics
- Settings — Server configuration
- Help — Full documentation with 6 tabs

### Data Export
Every data page has CSV and JSON export buttons. The Messages page also has a Markdown export that formats messages for pasting into Notion, Obsidian, or any markdown app.

## Discord API Considerations

### Rate Limits
Discord enforces per-route rate limits. The server auto-retries up to 5 times. If you get frequent 429s, the server returns a structured error with the Discord response body. Server-side anti-spam limits (configurable via DISCORD_RATE_LIMIT_*) add an extra protection layer.

### Intents
Some operations require privileged intents in the Discord Developer Portal:
- GUILD_MEMBERS — Required for list_members, get_member
- MESSAGE_CONTENT — Required for reading message content (get_messages, rag_ingest)

Enable these in Developer Portal → Bot → Privileged Gateway Intents, then regenerate the invite URL.

### Permission Errors
If an operation returns "Missing Access" (403), the bot doesn't have the required permission in that guild. Check:
1. The bot has the right permissions in the invite URL
2. The permissions were actually granted (guild master may have reduced them)
3. The role hierarchy allows the bot to perform the action

### Guild Limit
Unverified bots can join 10 servers max. Verify the bot in Developer Portal to raise this to 100.

## Troubleshooting

### Bot token not working
You copied the token from the Bot page, not the client secret from General Information. Bot tokens are longer base64-like strings.

### Sampling shows Offline
Start Ollama locally or set DISCORD_SAMPLING_BASE_URL to an OpenAI-compatible endpoint. Set DISCORD_SAMPLING_USE_CLIENT_LLM=1 to use the MCP host's LLM.

### Port conflict
Kill zombie processes on 10756/10757, then re-run start.ps1.

### Rate limited
The server returns 429 with a message telling you which rate limit was hit and the env var to override it. Tune DISCORD_RATE_LIMIT_* vars or wait for the rate window to reset.
