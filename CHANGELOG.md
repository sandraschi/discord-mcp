
## [Unreleased] — 2026-07-24

### Added
- **Channel CRUD:** `delete_channel` operation in portmanteau tool; `POST /api/v1/guilds/{id}/channels` and `DELETE /api/v1/channels/{id}` REST endpoints; Create and Delete buttons on the Channels dashboard page.
- **Help page rewrite:** Replaced sparse bullet lists with 6 substantive tabs — About Discord, What You Can Do, MCP Tools (full operation reference), RAG, Env & Setup, FAQ.
- **Markdown export:** `export_messages` portmanteau operation — fetch channel messages as formatted markdown for Notion/Obsidian. REST `GET /api/v1/channels/{id}/export`. Export Markdown + Copy buttons on Messages page.
- **Channel navigation:** Click a channel name on the Channels page to open the Messages page with that channel pre-loaded.
- **Create invite:** New "Create Invite" form on the Invites page with channel selector, max age/uses, and one-click copy.
- **Invite usage badges:** Unused invites show grey; used invites show a green "Used Nx" badge with dot indicator. Refresh button re-fetches without page reload.
- **Live test suite:** 8 integration tests under `tests/live/` hitting the real Discord API (channel CRUD, messages, invites, guilds). Gated behind `DISCORD_LIVE_TEST=1`.
- **`docs/PLATFORMS.md`:** Discord vs Slack, Reddit, Telegram, Teams — positioning, bot API, MCP suitability, community culture.
- **Docs:** AI & LLM policy, rate limits & anti-spam, bot verification, guild master invite flow, cross-guild permissions clarification.

### Fixed
- **`webapp/start.ps1`:** Added missing `$Root` definition — `Split-Path $PSScriptRoot -Parent` was missing, causing `Join-Path` to resolve `scripts\FleetStartMode.ps1` as a relative path that didn't match. Fixed parameter set conflict between `-LiteralPath` and `-Parent` in `Split-Path`.
- **Empty message validation:** `POST /api/v1/channels/{id}/messages` with empty content now returns 422 instead of 502.
- **Invite REST endpoints:** Added `POST /api/v1/channels/{id}/invites` and `DELETE /api/v1/invites/{code}`.

# Changelog

All notable changes to **discord-mcp** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning is semantic for releases.

## [Unreleased]

### Changed

- **Documentation:** Fleet README structure — short README with TOC; detailed guides in `docs/` (CONFIGURATION, TOOLS, WEBAPP, CURSOR-MCP, DEVELOPMENT, TROUBLESHOOTING); INSTALL.md Options A–D.

## [0.2.0] - 2026-06-08

### Added

- **36 portmanteau operations:** moderation (`ban_member`, `unban_member`, `kick_member`, `timeout_member`, `list_bans`), messaging (`edit_message`, `delete_message`, `create_dm`), roles, webhooks, emojis, stickers, `get_audit_log`.
- **30 REST endpoints** mirroring new operations under `/api/v1/…` (OpenAPI at `/docs`).
- **CI:** GitHub Actions on Windows — ruff lint, pytest.
- **Tests:** rate-limit and REST health/meta/skills coverage (14 pass, 1 xfail for `/mcp` lifespan).
- **Playwright e2e:** dashboard and API smoke tests in `webapp/e2e/`.
- **Tauri native scaffold** under `native/` (release build on `v*` tags).
- **Vendored `scripts/FleetStartMode.ps1`** — no runtime dependency on mcp-central-docs.
- **Agentic workflow** expanded tool surface for moderation, roles, and webhooks.

### Fixed

- **Security (S104):** uvicorn binds to `127.0.0.1` instead of `0.0.0.0`.
- **Security (S110):** bare `except: pass` replaced with logged warnings in sampling handler.
- **`webapp/start.ps1`:** repo root path and FleetStartMode per-port clearing.

### Changed

- **FastMCP 3.2** standardization (`pyproject.toml`, sampling, skills caching).
- Webapp UI refresh across dashboard, guilds, channels, messages, settings, stats pages.
- Removed unused `structlog` dependency; improved docstrings and TYPE_CHECKING hygiene.

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
- **Rate limit UX:** Clearer handling of Discord's per-route 429 vs in-repo anti-spam limits (documented in README).

### Changed

- Replaced `FastMCP.from_fastapi`-only wiring with explicit **FastMCP** instance + REST app + `app.mount("/mcp", …)`.


