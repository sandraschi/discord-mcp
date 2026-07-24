# Discord MCP

<p align="center">
  <a href="https://github.com/casey/just"><img src="https://img.shields.io/badge/just-ready_to_go-7c5cfc?style=flat-square&logo=just&logoColor=white" alt="Just"></a>
  <a href="https://github.com/astral-sh/ruff"><img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json" alt="Ruff"></a>
  <a href="https://python.org"><img src="https://img.shields.io/badge/Python-3.13+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"></a>
  <a href="tests/"><img src="https://img.shields.io/badge/tests-49%20passing-brightgreen?style=flat-square" alt="Tests"></a>
  <a href="https://biomejs.dev"><img src="https://img.shields.io/badge/Linted_with-Biome-60a5fa?style=flat-square&logo=biome&logoColor=white" alt="Biome"></a>
  <a href="https://github.com/PrefectHQ/fastmcp"><img src="https://img.shields.io/badge/FastMCP-3.2-7c5cfc?style=flat-square" alt="FastMCP"></a>
</p>

Connect your Discord bot to MCP clients — list servers, send messages, moderate members, search message history with RAG, and run agentic workflows from Cursor or Claude Desktop.

**v0.2.0** · 36 operations · FastMCP 3.2 · Comms lane · [Releases](https://github.com/sandraschi/discord-mcp/releases)

---

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [What you can do](#what-you-can-do)
- [Ports](#ports)
- [Documentation](#documentation)
- [Requirements](#requirements)

---

## Features

- **36 Discord operations** in one portmanteau tool — messaging, moderation, roles, webhooks, audit log, RAG
- **Fleet web dashboard** — guilds, channels, messages, agentic chat, LanceDB search (ports **10756** / **10757**)
- **Agentic workflow** — describe a goal; server uses sampling + tools (SEP-1577)
- **Dual transport** — stdio for IDE hosts, streamable HTTP at `/mcp` for remote clients
- **Built-in safety** — anti-spam rate limits, Discord 429 auto-retry, bind localhost only
- **Bundled skills & prompts** — moderation playbook, RAG workflow, ops guides

---

## Quick start

```powershell
git clone https://github.com/sandraschi/discord-mcp
cd discord-mcp
.\start.ps1
```

1. Copy `.env.example` → `.env` and set `DISCORD_TOKEN` ([bot setup](docs/CONFIGURATION.md#discord-bot-token))
2. Open dashboard **http://127.0.0.1:10757** · API **http://127.0.0.1:10756**

Other install paths (just, Cursor, Claude Desktop, no-git): **[INSTALL.md](INSTALL.md)**

---

## What you can do

**List servers and post a message**

> List my Discord guilds, then send "Fleet check-in OK" to channel `#general` in the first server.

**Moderation assist**

> Show recent audit log entries for guild `123456789` and summarize ban/kick events from the last 24 hours.

**Search ingested history**

> Ingest the last 50 messages from `#dev`, then answer: what did we decide about the CI workflow?

---

## Ports

| Service | Port | URL |
|---------|------|-----|
| Backend (REST + MCP `/mcp`) | 10756 | http://127.0.0.1:10756 |
| Web dashboard | 10757 | http://127.0.0.1:10757 |

---

## Documentation

| Doc | Contents |
|-----|----------|
| [INSTALL.md](INSTALL.md) | All install methods, prerequisites, verify steps |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Bot token, env vars, sampling, rate limits |
| [docs/TOOLS.md](docs/TOOLS.md) | MCP tools, operations, prompts, skills |
| [docs/WEBAPP.md](docs/WEBAPP.md) | Dashboard pages and REST API overview |
| [docs/CURSOR-MCP.md](docs/CURSOR-MCP.md) | Cursor / Claude Desktop MCP wiring |
| [docs/TECHNICAL.md](docs/TECHNICAL.md) | Architecture, transports, Discord 429 behavior |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local dev, lint, test, CI |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common errors and fixes |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |

Fleet central mirror: [mcp-central-docs/projects/discord-mcp](https://github.com/sandraschi/mcp-central-docs/tree/master/projects/discord-mcp)

---

## Requirements

- **Windows** (primary; fleet dev target) or macOS/Linux with Python 3.12+
- **[uv](https://docs.astral.sh/uv/)** for Python deps · **Node 20+** for the webapp
- **Discord bot token** — free at [Discord Developer Portal](https://discord.com/developers/applications)
- Optional: [Ollama](https://ollama.com) for local agentic sampling when the MCP host has no LLM

> **Guild limit:** Unverified bots can join **10 servers max**. To raise the cap, verify your bot
> in Developer Portal → your application → Settings → Bot → Verification (requires description,
> screenshots, privacy policy). Once verified, the bot can join up to 100 servers.
>
> **How guild masters add the bot:** Send them the invite URL. They open it, select their server,
> choose which permissions to grant (or keep the defaults from the URL), and Authorise. The bot
> appears in their member list with a **BOT** tag.
>
> **What the bot can do depends on the permissions each guild master granted.** The invite URL
> above requests Administrator (`permissions=8`), which gives full access. But the guild master
> can reduce permissions during authorisation. With full Admin the bot can read/search/post
> messages, moderate, manage channels/roles/webhooks, and view audit logs. With limited
> permissions it can only do what was allowed. The permissions are per-guild, so the bot may be
> admin in one server and read-only in another.

---

## Rate Limits & Anti-Spam

The server enforces two layers of rate limiting to prevent abuse and Discord API bans.

### Server-Side Anti-Spam (configurable)

| Limit | Default | Env Var |
|-------|---------|---------|
| Messages per minute (global) | 10 | `DISCORD_RATE_LIMIT_MESSAGES_PER_MINUTE` |
| Messages per channel per minute | 3 | `DISCORD_RATE_LIMIT_MESSAGES_PER_CHANNEL_PER_MINUTE` |
| Min interval between messages | 5s | `DISCORD_MIN_MESSAGE_INTERVAL_SECONDS` |
| Channels created per minute | 5 | `DISCORD_RATE_LIMIT_CHANNELS_PER_MINUTE` |
| Invites created per minute | 5 | `DISCORD_RATE_LIMIT_INVITES_PER_MINUTE` |
| Max message length | 2000 | `DISCORD_MAX_MESSAGE_LENGTH` |

These limits are checked **before** the request reaches Discord. If you hit one, the API returns a 429 with a message telling you which limit and how to override it.

### Discord API Rate Limits (automatic retry)

Discord itself enforces per-route rate limits (HTTP 429 with `retry_after`). The server automatically retries up to **5 times** with exponential backoff, respecting Discord's `Retry-After` header. If all retries are exhausted, a structured error is returned.

### Why both?

The server-side limits prevent your bot from getting **suspended** by Discord's abuse detection. They're conservative by default — tune them up for private servers, or tighten them for public bots.

---

**Repository:** [github.com/sandraschi/discord-mcp](https://github.com/sandraschi/discord-mcp)
