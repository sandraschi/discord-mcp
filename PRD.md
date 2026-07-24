# discord-mcp — Product Requirements Document

**Status:** ACTIVE (v0.2.0)
**Package version:** 0.2.0 (`pyproject.toml`)
**Owner:** Sandra Schieder
**Ports:** 10756 (backend), 10757 (dashboard)
**Category:** Comms / Chat

## Overview

FastMCP 3.2 Discord bridge — 36 portmanteau operations, LanceDB RAG, sampling-based agentic workflows, bundled skills, and SOTA web dashboard.

## Problem Statement

Discord servers accumulate operational noise (moderation events, support tickets, CI notifications) that can't be queried, searched, or acted upon from MCP clients (Cursor, Claude Desktop). Administrators need a programmable interface to their Discord guilds — list, message, moderate, audit, and search — without leaving their coding environment.

## Target Audience

- Developers managing Discord communities who want MCP-driven moderation and audit
- Fleet ops — automated alert delivery via Discord webhooks from other MCP servers
- AI agents — moderation, content review, and history search via MCP tools

## Success Metrics

| Metric | Target |
|--------|--------|
| Discord API 429 auto-retry | Bounded retry (5 attempts), structured error response |
| Rate-limit safety | Per-channel + global anti-spam limits enforced server-side |
| RAG search | LanceDB semantic search over ingested Discord history |
| Agentic workflow | SEP-1577 sampling-based multi-step tasks |
| Dashboard uptime | REST health + guild/channel/message views always reachable while backend runs |

## Requirements

### Functional — Shipped (v0.1.0)

- **REQ-001:** List guilds and channels
- **REQ-002:** Send, edit, delete messages
- **REQ-003:** Create invites
- **REQ-004:** Dual transport (stdio + streamable HTTP `/mcp`)
- **REQ-005:** REST health/meta/skills endpoints
- **REQ-006:** Discord API 429 automatic retry (5 attempts, `retry_after` parsing)
- **REQ-007:** Skills directory (`skill://discord-mcp/...`)
- **REQ-008:** Sampling handler (Ollama / client LLM)

### Functional — Extended (v0.2.0)

- **REQ-101:** 36 operations: moderation (ban, kick, timeout, audit log), roles (CRUD + assign), webhooks, emojis, stickers, DM, RAG ingest/query
- **REQ-102:** 30 REST endpoints mirroring operations
- **REQ-103:** SOTA web dashboard with guilds, channels, messages, agentic chat, settings pages
- **REQ-104:** GitHub Actions CI (ruff, pytest)
- **REQ-105:** Playwright E2E tests
- **REQ-106:** Tauri NSIS native scaffold
- **REQ-107:** Vendored FleetStartMode launcher

### Functional — Planned

- **REQ-201:** MCPB bundle for Claude Desktop distribution
- **REQ-202:** Multi-server (bot-farm) support
- **REQ-203:** Message reaction events via gateway

### Non-Functional

| Area | Requirement |
|------|-------------|
| **Security** | Bind `127.0.0.1` only |
| **Safety** | Anti-spam rate limits (per-channel + global) |
| **Safety** | `dry_run=false` guard on destructive operations |
| **Portability** | Windows primary, POSIX compatible |

## Technical Architecture

```
MCP Client (Cursor / Claude Desktop)
     │ stdio or streamable HTTP
     ▼
FastMCP 3.2 Server (:10756)
     │ REST API (/api/v1/*)
     │ MCP HTTP (/mcp)
     ▼
Discord REST API (api.discord.com)
     │
     ├── Guilds / Channels / Messages
     ├── Moderation (ban/kick/timeout)
     ├── Roles / Permissions
     └── Audit Log
```

## Implementation Plan

### Phase 1 — Shipped (v0.1.0)

Core MCP server: `discord` portmanteau with 12 ops, REST health/meta/skills, streamable HTTP `/mcp`, skills directory, sampling handler, basic webapp.

### Phase 2 — Shipped (v0.2.0)

Expanded to 36 ops, full REST API, SOTA dashboard, CI, Playwright tests, Tauri native scaffold.

### Phase 3 — Planned (v0.3.0)

MCPB distribution package, bot-farm multi-server routing, full gateway event dispatch, advanced moderation workflows (auto-mod rules).

## Out of Scope

- Hosting the Discord bot gateway (handled by Discord's infrastructure)
- Slack or Teams bridge (separate repos)
- Message archiving to S3/cloud storage
- Bot dashboard for non-technical users

## References

- [README.md](README.md)
- [docs/TECHNICAL.md](docs/TECHNICAL.md)
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md)
- [mcp-central-docs/projects/discord-mcp/README.md](../mcp-central-docs/projects/discord-mcp/README.md)
