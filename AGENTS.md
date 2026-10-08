# discord-mcp — Agent Guide

Fleet MCP server (Comms lane). See `justfile` for available recipes.

## Overview

FastMCP 3.2 Discord MCP server — 47+ portmanteau operations, sampling, agentic workflow, SOTA RAG with local LanceDB + FastEmbed/sentence-transformers, selective guild/channel depot archiving, and fleet webapp (ports 10756/10757).

## Standards

- FastMCP 3.2+ portmanteau tool pattern — `discord(operation=…)` dispatches internally (includes `rag_sweep`, `rag_query`, `rag_stats`, `depot_sync`, `depot_list`)
- Responses: structured dicts with `success`, `message`, domain-specific fields
- Dual transport: stdio (Cursor/Claude Desktop) + HTTP (`/mcp` on port 10756)
- RAG Operations Standard compliant: non-blocking asynchronous sweep jobs (`POST /api/rag/sweep`, `GET /api/rag/status/{job_id}`, `GET /api/rag/stats`) and local channel depot caching (`data/depot/guilds/{guild_id}/{channel_id}.jsonl`)
- See [mcp-central-docs](https://github.com/sandraschi/mcp-central-docs) for fleet-wide coding standards

## Key Files

- `README.md` — full documentation
- `pyproject.toml` — build config and entry points
- `docs/TECHNICAL.md` — architecture, env, Discord 429 behavior
- `CLAUDE.md` — Claude Code context (if present)

Install docs: follow mcp-central-docs/standards/AGENT_INSTALL_REFERENCE.md

## Quick Ref

```powershell
just test
just lint
just serve
```

## Session close (HARD — no dirty-tree handoffs)

End EVERY working session with zero `git status` dirt attributable to you:
finish and commit it, or revert it. Never leave WIP for "someone else"
— past sessions did exactly that and it cost a full incident review.
Update HANDOVER.md (root + mirror at
`mcp-central-docs/projects/discord-mcp/HANDOVER.md`) with: what changed,
how it was verified, what is still open, what was deliberately NOT done.
`.bak` files are gitignored — clean them when the work is accepted.
