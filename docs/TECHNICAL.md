# discord-mcp — technical reference

**Last updated:** 2026-03-20

## Architecture

- **Single process (HTTP mode):** One **FastAPI** app serves REST (`/api/v1/…`, OpenAPI `/docs`) and mounts **FastMCP** streamable HTTP at **`/mcp`**.
- **Stdio mode:** `python -m discord_mcp.server --mode stdio` runs **only** the MCP server (`mcp.run_stdio_async()`), no REST.
- **Portmanteau:** `discord(operation=…)` in `portmanteau.py` — Discord REST v10 via **httpx**.
- **Agentic:** `agentic.py` uses `ctx.sample()` with small async tool functions that call the same REST helpers (SEP-1577).

## Environment

| Variable | Role |
|----------|------|
| `DISCORD_TOKEN` | Bot token (`Bot …` prefix added in code). Loaded from **repo-root `.env`** via **python-dotenv** at import time. Does **not** override an already-set OS/Cursor env. |
| `DISCORD_SAMPLING_*` | Server-side OpenAI-compatible LLM for sampling (default Ollama URL/model). |
| `DISCORD_SAMPLING_USE_CLIENT_LLM` | If `1`/`true`/`yes`, sampling handler is **fallback** only; host LLM preferred. |
| `DISCORD_RATE_LIMIT_*` | In-repo anti-spam limits (messages, channels, invites). |

## Discord API HTTP 429

Discord applies **per-route** rate limits. The client implements **`_discord_request`**: on **429**, read **`retry_after`** (JSON) or **`Retry-After`** header, **`asyncio.sleep`**, retry up to **5** times (single wait capped at **60s**). Remaining 429 responses return **`_discord_api_error`** (`rate_limited`, `retry_after_seconds`, `global_rate_limit` when present).

This is **independent** of in-repo `DISCORD_RATE_LIMIT_*` (those gate `send_message`, etc., before hitting the network).

## MCP clients

- **Cursor / Claude:** stdio — `.cursor/mcp.json` or user MCP JSON; set `cwd` to repo root.
- **HTTP:** Base URL `http://127.0.0.1:10756`, path **`/mcp`** (streamable HTTP).

## Webapp

- **Vite** dev server **10757**; `vite.config.ts` proxies **`/api`** → **10756**.
- **Launcher bugfix:** `webapp/start.ps1` sets repo root to **`Split-Path -Parent $PSScriptRoot`** (one level above `webapp`). Central launcher **`mcp-central-docs/starts/discord-start.bat`** uses `cd` to `..\..\discord-mcp\webapp` so it works when run from `starts/` (symlinked `.bat` broke `%dp0`).

## Skills

Bundled folders under `src/discord_mcp/skills/<name>/SKILL.md` are exposed via FastMCP **SkillsDirectoryProvider** as MCP resources (`skill://…`).
