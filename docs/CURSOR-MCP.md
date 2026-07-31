# Cursor & Claude Desktop MCP Setup

## Cursor (workspace)

When **discord-mcp** is the workspace root, `.cursor/mcp.json` registers stdio transport. Set `DISCORD_TOKEN` in the `env` block or rely on shell / `.env`.

Reload MCP or restart Cursor after edits.

## Cursor (global / multi-root)

Copy the `discord-mcp` block from `cursor-config-template.json` into:

`%USERPROFILE%\.cursor\mcp.json`

Adjust `cwd` and `PYTHONPATH` to your clone path if not using `D:/Dev/repos/discord-mcp`.

## Claude Desktop

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "discord-mcp": {
      "command": "uv",
      "args": [
        "--directory",
        "C:\\path\\to\\discord-mcp",
        "run",
        "python",
        "-m",
        "discord_mcp.server",
        "--mode",
        "stdio"
      ],
      "env": {
        "DISCORD_TOKEN": "your_bot_token_here",
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

Restart Claude Desktop.

## HTTP / MCP Inspector

For streamable HTTP (no stdio):

1. Start backend: `uv run python -m discord_mcp.server --mode dual --port 10756`
2. Connect to `http://127.0.0.1:10756/mcp`
3. Health check: `GET http://127.0.0.1:10756/api/v1/health`

## Verify

In your MCP host, try:

> List Discord servers this bot can see.

Expected: JSON with server names and IDs, or a clear error if `DISCORD_TOKEN` is missing.

See [CONFIGURATION.md](./CONFIGURATION.md) for token and env details.
