# Development Setup

## Tools required

Install on Windows via winget:

```powershell
winget install astral-sh.uv
winget install Git.Git
winget install OpenJS.NodeJS
winget install Casey.Just
```

Verify:

```powershell
uv --version
git --version
node --version
just --version
```

## Clone and bootstrap

```powershell
git clone https://github.com/sandraschi/discord-mcp
cd discord-mcp
just bootstrap
```

`just bootstrap` runs `uv sync` and `npm install` in `webapp/`.

## Common tasks

| Command | Purpose |
|---------|---------|
| `just serve` | Full stack (backend + dashboard) via `start.ps1` |
| `just web` | Frontend only (Vite on 10757) |
| `just test` | pytest (`tests/`) |
| `just lint` | ruff + Biome |
| `just fix` | Auto-fix lint + format |
| `just e2e` | Playwright smoke tests (local; starts backend) |
| `just check-sec` | bandit audit |
| `just build-native` | Tauri desktop app (Windows) |

Backend only:

```powershell
uv run python -m discord_mcp.server --mode dual --port 10756
```

Stdio only:

```powershell
uv run python -m discord_mcp.server --mode stdio
```

## Project layout

```
src/discord_mcp/     Python MCP server + REST
  portmanteau.py     discord(operation=…) — 36 ops
  server.py          FastAPI + FastMCP mount
  agentic.py         discord_agentic_workflow
  skills/            Bundled SKILL.md files
webapp/              React + Vite dashboard
tests/               pytest
native/              Tauri scaffold (optional)
```

## CI

Minimal Windows workflow (`.github/workflows/ci.yml`): `uv sync --all-extras` → `ruff check src/` → `pytest tests/ -q`.

## Code standards

- **Python:** Ruff (lint + format), no `print` in core handlers (`T201`)
- **Webapp:** Biome, strict `noConsoleLog`
- **Fleet docs:** [mcp-central-docs/standards](https://github.com/sandraschi/mcp-central-docs/tree/master/standards)

Architecture detail: [TECHNICAL.md](./TECHNICAL.md)
