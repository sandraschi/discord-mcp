# Installing discord-mcp

## Prerequisites

Install these if you don't have them:

| Tool | Purpose | Install (Windows) |
|------|---------|-------------------|
| Git | Clone repo (Options C/D) | `winget install Git.Git` |
| uv | Python deps | `winget install astral-sh.uv` |
| Node.js | Webapp (Options C/D) | `winget install OpenJS.NodeJS` |
| just | Fleet recipes (optional) | `winget install Casey.Just` |

> macOS: `brew install uv git node just` · Linux: use your distro or [uv](https://docs.astral.sh/uv/) installer

You also need a **Discord bot token** — see [docs/CONFIGURATION.md](docs/CONFIGURATION.md#discord-bot-token).

---

## Option A — MCPB drag and drop (when published)

1. Go to [Releases](https://github.com/sandraschi/discord-mcp/releases/latest)
2. Download `discord-mcp-*.mcpb` (when available)
3. Claude Desktop → Settings → MCP Servers → Install from file

Until MCPB ships, use Option B or C.

---

## Option B — Fastest from source

```powershell
git clone https://github.com/sandraschi/discord-mcp
cd discord-mcp
copy .env.example .env
# Edit .env — set DISCORD_TOKEN
.\start.ps1
```

Opens dashboard **http://127.0.0.1:10757** · backend **http://127.0.0.1:10756**.

---

## Option C — Manual from source

```powershell
git clone https://github.com/sandraschi/discord-mcp
cd discord-mcp
uv sync --all-extras
Set-Location webapp
npm install
Set-Location ..
copy .env.example .env
# Edit .env — set DISCORD_TOKEN
.\start.ps1
```

**Stdio only** (no webapp):

```powershell
uv run python -m discord_mcp.server --mode stdio
```

Add to Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`):

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

Cursor wiring: [docs/CURSOR-MCP.md](docs/CURSOR-MCP.md)

---

## Option D — Developer mode

Uses `just` for bootstrap, lint, test, and serve:

```powershell
winget install Casey.Just
git clone https://github.com/sandraschi/discord-mcp
cd discord-mcp
just bootstrap
just serve
```

Full dev guide: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

---

## Verify installation

1. Open **http://127.0.0.1:10757/dashboard** — health indicator should show backend connected.
2. Or: `GET http://127.0.0.1:10756/api/v1/health` → `"status": "ok"`, `"token_set": true`.
3. In your MCP host, ask: **List Discord guilds this bot can see.**

---

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

| Issue | Fix |
|-------|-----|
| `just` not found | `winget install Casey.Just` or use Option B/C without just |
| Port conflict | Stop other service on 10756/10757 |
| Token errors | [CONFIGURATION.md](docs/CONFIGURATION.md) |

---

*Feature overview: [README.md](README.md)*
