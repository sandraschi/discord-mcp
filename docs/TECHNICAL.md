# discord-mcp — technical reference

**Last updated:** 2026-06-08

## Architecture

- **Single process (HTTP mode):** One **FastAPI** app serves REST (`/api/v1/…`, OpenAPI `/docs`) and mounts **FastMCP** streamable HTTP at **`/mcp`**.
- **Stdio mode:** `python -m discord_mcp.server --mode stdio` runs **only** the MCP server (`mcp.run_stdio_async()`), no REST.
- **Portmanteau:** `discord(operation=…)` in `portmanteau.py` — **36 operations** against Discord REST v10 via **httpx**.
- **Agentic:** `agentic.py` uses `ctx.sample()` with async tool functions that call the same REST helpers (SEP-1577).

Configuration and env vars: **[CONFIGURATION.md](./CONFIGURATION.md)** · Tool list: **[TOOLS.md](./TOOLS.md)**

## Discord API HTTP 429

Discord applies **per-route** rate limits. The client implements **`_discord_request`**: on **429**, read **`retry_after`** (JSON) or **`Retry-After`** header, **`asyncio.sleep`**, retry up to **5** times (single wait capped at **60s**). Remaining 429 responses return **`_discord_api_error`** (`rate_limited`, `retry_after_seconds`, `global_rate_limit` when present).

This is **independent** of in-repo `DISCORD_RATE_LIMIT_*` (those gate `send_message`, etc., before hitting the network).

## MCP clients

- **Cursor / Claude:** stdio — see [CURSOR-MCP.md](./CURSOR-MCP.md)
- **HTTP:** Base URL `http://127.0.0.1:10756`, path **`/mcp`** (streamable HTTP)

## Webapp

- **Vite** dev server **10757**; `vite.config.ts` proxies **`/api`** → **10756**.
- **Launcher:** `webapp/start.ps1` sets repo root to **`Split-Path -Parent $PSScriptRoot`**. Fleet launcher **`mcp-central-docs/starts/discord-start.bat`** uses `cd` to `..\..\discord-mcp\webapp`.

Dashboard routes and REST map: **[WEBAPP.md](./WEBAPP.md)**

## Skills

Bundled folders under `src/discord_mcp/skills/<name>/SKILL.md` are exposed via FastMCP **SkillsDirectoryProvider** as MCP resources (`skill://…`).

## Security notes

- Uvicorn binds **127.0.0.1** only (S104).
- Sampling handler logs warnings instead of silent bare except (S110).
- In-repo write rate limits — see [CONFIGURATION.md](./CONFIGURATION.md#rate-limits-in-repo-anti-spam).
