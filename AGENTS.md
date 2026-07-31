# discord-mcp — Agent Guide

Fleet MCP server (Comms lane). See `justfile` for available recipes.

## Overview

FastMCP 3.2 Discord MCP server — 43 portmanteau operations, sampling, agentic workflow, and fleet webapp (ports 10756/10757).

## Standards

- FastMCP 3.2+ portmanteau tool pattern — `discord(operation=…)` dispatches internally
- Responses: structured dicts with `success`, `message`, domain-specific fields
- Dual transport: stdio (Cursor/Claude Desktop) + HTTP (`/mcp` on port 10756)
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
