# Configuration

## Discord bot token

1. Create an application at [Discord Developer Portal](https://discord.com/developers/applications).
2. **Bot** tab → **Reset Token** → copy the token.
3. **OAuth2 → URL Generator** → scopes: `bot` → pick permissions (Send Messages, Read Message History, Manage Messages as needed) → invite to your server.
4. For `list_members` / `get_member`: enable **Server Members Intent** under **Bot → Privileged Gateway Intents**.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_TOKEN` | — | Bot token (required). `DISCORD_BOT_TOKEN` accepted as fallback. |
| `PORT` | `10756` | Backend HTTP port |
| `DISCORD_SAMPLING_BASE_URL` | `http://127.0.0.1:11434/v1` | OpenAI-compatible API for server-side sampling (Ollama) |
| `DISCORD_SAMPLING_MODEL` | `llama3.2` | Model name for sampling |
| `DISCORD_SAMPLING_API_KEY` | — | Optional Bearer token for cloud/local proxy |
| `DISCORD_SAMPLING_USE_OPENAI_KEY` | — | Use `OPENAI_API_KEY` for sampling when set |
| `DISCORD_SAMPLING_USE_CLIENT_LLM` | — | `1` / `true` / `yes` → prefer host LLM; server handler is fallback only |
| `DISCORD_RATE_LIMIT_MESSAGES_PER_MINUTE` | `10` | Global send cap per minute |
| `DISCORD_RATE_LIMIT_MESSAGES_PER_CHANNEL_PER_MINUTE` | `3` | Per-channel send cap per minute |
| `DISCORD_RATE_LIMIT_CHANNELS_PER_MINUTE` | `5` | Channel create cap per minute |
| `DISCORD_RATE_LIMIT_INVITES_PER_MINUTE` | `5` | Invite create cap per minute |
| `DISCORD_MAX_MESSAGE_LENGTH` | `2000` | Max message length (Discord limit) |
| `DISCORD_MIN_MESSAGE_INTERVAL_SECONDS` | `5.0` | Minimum gap between any two sends |

## Setting variables

### Repo `.env` (recommended for local dev)

Copy `.env.example` to `.env` in the repo root:

```powershell
DISCORD_TOKEN=your_bot_token_here
```

Loaded via `python-dotenv` at startup. **Does not override** an already-set OS or MCP host env var.

### Cursor MCP (`stdio`)

Workspace: `.cursor/mcp.json` · Global: `%USERPROFILE%\.cursor\mcp.json`

```json
{
  "mcpServers": {
    "discord-mcp": {
      "command": "uv",
      "args": ["run", "python", "-m", "discord_mcp.server", "--mode", "stdio"],
      "cwd": "D:/Dev/repos/discord-mcp",
      "env": {
        "DISCORD_TOKEN": "your_bot_token_here",
        "PYTHONPATH": "D:/Dev/repos/discord-mcp/src"
      }
    }
  }
}
```

See [CURSOR-MCP.md](./CURSOR-MCP.md) for full wiring. Restart the MCP host after edits.

### Claude Desktop

```json
{
  "mcpServers": {
    "discord-mcp": {
      "command": "uv",
      "args": ["--directory", "C:\\path\\to\\discord-mcp", "run", "python", "-m", "discord_mcp.server", "--mode", "stdio"],
      "env": {
        "DISCORD_TOKEN": "your_bot_token_here",
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

Config file:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

## Sampling (agentic workflow)

When the MCP host supports `ctx.sample`, the host LLM drives planning. Otherwise:

- Run **Ollama** locally and set `DISCORD_SAMPLING_BASE_URL` / `DISCORD_SAMPLING_MODEL`, or
- Set `DISCORD_SAMPLING_USE_CLIENT_LLM=1` to prefer the host and use the server handler only as fallback.

Check sampling status: `GET http://127.0.0.1:10756/api/v1/health` → `sampling` field.

## Rate limits (in-repo anti-spam)

Separate from Discord's HTTP 429 — these gate writes **before** hitting the API. Current values appear under `rate_limit` in `/api/v1/health`. On limit hit, tools return `success: false`, `rate_limited: true`, and an `error` message.

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#rate-limited-by-discord-mcp) and [TECHNICAL.md](./TECHNICAL.md#discord-api-http-429) for Discord-side limits.
