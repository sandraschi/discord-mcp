# Changelog

All notable changes to **discord-mcp** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning is semantic for releases; `0.1.0` is the current baseline.

## [Unreleased]

### Added
- **Documentation:** `docs/README.md`, `docs/TECHNICAL.md` (architecture, env, Discord 429 behavior).
- **Central docs:** Project pack under `mcp-central-docs/projects/discord-mcp` (local: `D:/Dev/repos/mcp-central-docs/projects/discord-mcp`).

## [0.1.0] - 2026-03-20

### Added
- **FastMCP 3.1** server: `discord`, `discord_help`, `discord_agentic_workflow`; instructions; sampling handler (`DiscordSamplingHandler`, `DISCORD_SAMPLING_*`); **SkillsDirectoryProvider** (`src/discord_mcp/skills/`); prompts; resource `resource://discord-mcp/capabilities`.
- **REST:** `GET /api/v1/health`, `/meta`, `/skills`; FastAPI routes under `/api/v1/…`.
- **MCP HTTP:** Streamable HTTP mounted at **`/mcp`** (same host as REST, default port **10756**).
- **`.env` loading:** `python-dotenv` loads repo-root `.env` at startup (`DISCORD_TOKEN`, sampling vars).
- **Webapp (10757):** Fleet-style shell (top bar, activity log), pages Dashboard, Tools, Skills, Apps; Vite proxy to backend.
- **Starts launcher:** `mcp-central-docs/starts/discord-start.bat` → resolves to `discord-mcp/webapp` (relative `cd`, not symlink — avoids `%dp0` failure).
- **Glama:** `glama.json` for local discovery.
- **Discord API 429:** Automatic retry (up to 5) using `retry_after` / `Retry-After`; structured `_discord_api_error` for remaining failures.

### Fixed
- **`webapp/start.ps1`:** Repo root was one directory too high (`Split-Path` ×2); corrected to single parent of `webapp`.
- **Rate limit UX:** Clearer handling of Discord’s per-route 429 vs in-repo anti-spam limits (documented in README).

### Changed
- Replaced `FastMCP.from_fastapi`-only wiring with explicit **FastMCP** instance + REST app + `app.mount("/mcp", …)`.
