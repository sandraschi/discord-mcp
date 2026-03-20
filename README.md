# Discord MCP

FastMCP **3.1** Discord MCP server with **sampling** (server-side Ollama / OpenAI-compatible or client LLM), **agentic workflow** (`discord_agentic_workflow`), **skills** (`SkillsDirectoryProvider` + `skill://…/SKILL.md`), **prompts**, and a **2026 fleet-style** dashboard (React + Vite + Tailwind, dark glass shell).

## Ports

- **Backend**: 10756 — REST (`/api/v1/…`) + MCP **streamable HTTP** at **`/mcp`**
- **Frontend**: 10757

## Setup

1. Create a bot at [Discord Developer Portal](https://discord.com/developers/applications). Copy the bot token.
2. Invite the bot to your server (OAuth2 URL Generator, scope: `bot`).
3. Copy `.env.example` to **`.env` in the repo root** (`discord-mcp/.env`) and set `DISCORD_TOKEN=...` (no quotes). The backend **loads this file on startup** (`python-dotenv`). **Restart** the server after changing `.env`. If the token is already set in the system environment or Cursor MCP `env`, that value wins (`.env` does not override existing vars).
4. For **local agentic sampling** (when the MCP host does not provide sampling): run [Ollama](https://ollama.com) and optionally set `DISCORD_SAMPLING_BASE_URL` / `DISCORD_SAMPLING_MODEL`. Set `DISCORD_SAMPLING_USE_CLIENT_LLM=1` if you want the **host** LLM to sample and the server handler only as fallback.

## Run

- **Webapp (backend + dashboard)**: from repo root run `.\start.ps1` or `start.bat`, or from `webapp/`: `.\start.ps1`.
- **Backend only**: `uv run python -m discord_mcp.server --mode dual --port 10756`
- **Stdio (MCP only)**: `uv run python -m discord_mcp.server --mode stdio`

## Cursor MCP

- **This repo as workspace root:** `.cursor/mcp.json` registers **discord-mcp** (stdio). Set **`DISCORD_TOKEN`** in that file’s `env` or rely on your shell environment. Reload MCP / restart Cursor after edits.
- **Global / multi-root merge:** copy the **`discord-mcp`** block from **`cursor-config-template.json`** into your user MCP JSON (Windows: `%USERPROFILE%\.cursor\mcp.json`). Adjust **`cwd`** to your clone path if you are not using the default `D:/Dev/repos/discord-mcp`.

## MCP HTTP (remote / Inspector)

- Endpoint: `http://localhost:10756/mcp` (streamable HTTP, FastMCP 3.1)
- Discovery / manifest: `GET /api/v1/meta`
- Health: `GET /api/v1/health` (includes sampling status)

## Tools

- **discord(operation=…)** — Portmanteau: `list_guilds`, `list_channels`, `send_message`, `get_messages`, `get_guild_stats`, `create_channel`, `create_guild`, `create_invite`, `list_invites`, `revoke_invite`, `list_members`, `get_member`, `list_active_threads`, `rag_ingest`, `rag_query`. `create_guild` requires user OAuth2 (bot 403). `list_members` / `get_member` require GUILD_MEMBERS intent.
- **discord_help(category=…, topic=…)** — Multi-level help.
- **discord_agentic_workflow(goal, ctx)** — High-level goal via `ctx.sample` + tools (SEP-1577). Returns a structured **dict** (`success`, `message`, `recommendations` or error fields).

## Prompts (registered)

`discord_quick_start`, `discord_diagnostics`, `discord_moderation_playbook`, `discord_rag_workflow`, `discord_invite_operations`

## Skills

Bundled under `src/discord_mcp/skills/<name>/SKILL.md`, exposed as MCP resources (`skill://…`). Listed in the dashboard under **Skills** and via `GET /api/v1/skills`.

## Resources

- `resource://discord-mcp/capabilities` — Short capability summary for clients.

## API (REST)

- `GET /api/v1/health` — Health, token_set, rate limits, sampling, `mcp_http_path`
- `GET /api/v1/meta` — Tools, prompts, resources, skills root, sampling
- `GET /api/v1/skills` — Bundled skill previews (dashboard)
- `GET /api/v1/guilds` — List guilds (proxy to tool)
- `GET /api/v1/guilds/{guild_id}/channels` — List channels
- (See OpenAPI at `/docs` for full list.)

## Discord HTTP 429 (API rate limits)

Discord enforces **per-route** limits on the REST API. On **HTTP 429**, the server now **waits** for `retry_after` (from the response body or `Retry-After` header) and **retries** the same request up to **5** times before returning an error. If you still see 429 after that, slow down (e.g. fewer parallel message fetches, smaller RAG ingest batches) or wait a minute—especially if `"global": true` appears in Discord’s response (rare; indicates a broader limit).

## Safety and rate limits (anti-spam)

Write operations are rate-limited so the bot is not usable as a spambot:

- **Messages**: max 10/min global, max 3/min per channel, min 5s between sends (configurable).
- **Channels**: max 5 created per minute.
- **Invites**: max 5 created per minute (`DISCORD_RATE_LIMIT_INVITES_PER_MINUTE`).
- **Message length**: capped at 2000 (Discord max); override with `DISCORD_MAX_MESSAGE_LENGTH`.

Env: `DISCORD_RATE_LIMIT_MESSAGES_PER_MINUTE`, `DISCORD_RATE_LIMIT_MESSAGES_PER_CHANNEL_PER_MINUTE`, `DISCORD_RATE_LIMIT_CHANNELS_PER_MINUTE`, `DISCORD_MAX_MESSAGE_LENGTH`, `DISCORD_MIN_MESSAGE_INTERVAL_SECONDS`. When a limit is hit, the tool returns `success: false`, `rate_limited: true`, and an explanatory `error`. Current config is in `GET /api/v1/health` under `rate_limit`.

## Documentation

- **[docs/README.md](docs/README.md)** — doc index  
- **[docs/TECHNICAL.md](docs/TECHNICAL.md)** — architecture, env, Discord 429, MCP `/mcp`  
- **[CHANGELOG.md](CHANGELOG.md)** — release notes  

## Standards

- FastMCP 3.1: instructions, sampling handler, skills provider, strict validation, streamable HTTP mount.
- Webapp: `start.ps1`, ports 10756/10757, dark glass layout, top bar status, activity log, Tools / Skills / Apps pages.
