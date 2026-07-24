# Contributing to discord-mcp

## Setup

```powershell
git clone https://github.com/sandraschi/discord-mcp
cd discord-mcp
uv sync --extra dev
cd webapp && npm install
```

## Development

Start the backend and frontend:

```powershell
.\start.ps1
```

Or individually:

```powershell
# Backend only
uv run python -m discord_mcp.server --mode dual --port 10756

# Frontend only (from webapp/)
npm run dev
```

## Code Style

- Python: Ruff (lint + format) — run `uv run ruff check src/` and `uv run ruff format src/`
- TypeScript/React: Biome — run `npx @biomejs/biome check --write .` from `webapp/`

## Testing

```powershell
# Unit tests (mocked, no Discord API needed)
uv run pytest tests/ -q

# Live integration tests (requires running backend + DISCORD_LIVE_TEST=1)
$env:DISCORD_LIVE_TEST = "1"
uv run pytest tests/live/ -v
```

## Adding a New Operation

1. Add the private `_operation()` function in `src/discord_mcp/portmanteau.py`
2. Add the dispatch `if op_lower == "operation_name"` in `discord_tool()`
3. Add a REST endpoint in `src/discord_mcp/server.py` if the operation should be web-accessible
4. If adding a REST endpoint, add the frontend API call in `webapp/src/lib/api.ts`
5. Update `llms-full.txt` with the new operation
6. Update `CHANGELOG.md`

## Pull Request Process

1. Update `CHANGELOG.md` with your changes
2. Ensure all tests pass
3. Update documentation if adding or changing operations
4. Open the PR against `main`

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful, constructive, and inclusive.
