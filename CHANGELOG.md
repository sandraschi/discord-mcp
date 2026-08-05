
## [Unreleased]
### Housekeeping (2026-08-05)
- Commit `5fee45f` (gitignore lib/ anchor fix) also carries the repo's pre-existing uncommitted
  WIP (cua webapp test scripts, TopBar theme work, index.css, lib helpers) - reviewed and kept.

### Added
- **7 new portmanteau operations (36 -> 43):** `get_channel`, `update_channel` (rename/topic/move-to-category/position/nsfw/slowmode), `update_guild`, `pin_message`, `unpin_message`, `get_pinned_messages`, `create_thread` (standalone or from a message). REST mirrors for all of them (`GET|PATCH /api/v1/channels/{id}`, `PATCH /api/v1/guilds/{id}`, `/api/v1/channels/{id}/pins`, `/api/v1/channels/{id}/threads`).
- **`list_channels` now returns `parent_id`** so the webapp can render the server hierarchy.
- **Server tree page** (`/tree`): collapsible category -> channel -> thread hierarchy with icons, plus a copyable ASCII view.
- **Servers catalog page** (`/guilds`): categorized "My servers" vs "Following" cards with curated descriptions/tags for known servers (opencode, ollama, lm studio, cursor), favorites, and **global server selection** via a Zustand store — one pick updates every page and persists to localStorage.
- **Human-readable audit log**: backend resolves action labels, actor and target names; frontend renders color-coded action badges and snowflake-derived timestamps.
- **Sampling model auto-resolution**: when `DISCORD_SAMPLING_MODEL` is unset, the server probes Ollama `/api/tags` and picks an installed model (prefers `llama3.2:3b`, excludes `:cloud` tags) instead of 404ing on a stale default.
- **2000-char content guard**: `send_message`/`edit_message`/`send_webhook` reject over-limit content with a structured `content_too_long` error instead of silently truncating.
- **Biome config + gate** (`webapp/biome.jsonc`, `biome:ci` npm script): Tailwind at-rule support; the fleet CI biome step now passes.

### Fixed
- **LLM completion 404**: agentic/sampling used the uninstalled default model `llama3.2`; agentic errors now include HTTP status + provider body.
- **Nested `<button>`** in the servers catalog (card vs favorite toggle).

## [0.3.0] — 2026-07-24

### Added
- **Prefab UI cards:** `show_guilds_card` and `show_guild_channels_card` with rich in-chat cards, `ToolResult(is_error=True)` on failure paths.
- **Skills REST endpoint:** `GET /api/v1/skills/{name}` returns full SKILL.md content.
- **Skills page rewrite:** Expandable cards load full content from REST, rendered with react-markdown (proper headings, code blocks, lists).
- **Chat skill-first architecture:** Fetches skills on mount, shows active skill badge in controls bar, Ollama online/offline status indicator.
- **SOTA provider detection:** Settings page probes Ollama (:11434), LM Studio (:1234), vLLM (:8000) in parallel with per-provider status, provider/model selector, model discovery, GPU opportunity prompt.
- **Governance files:** MIT license, CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, issue/PR templates.
- **MCPB bundle scaffold:** manifest.json, assets/icon.png, prompts (system.md 3000+w, user.md 4000+w, examples.json 100+).
- **Channel CRUD:** `delete_channel` operation; REST endpoints; Create/Delete on Channels page.
- **Help page rewrite:** 6 substantive tabs — About Discord, What You Can Do, MCP Tools, RAG, Env & Setup, FAQ.
- **Markdown export:** `export_messages` operation for Notion/Obsidian. REST `/export`. Copy button on Messages page.
- **Channel navigation:** Click channel name → Messages page with channel pre-loaded.
- **Create invite form:** Invites page with channel selector, max age/uses, one-click copy.
- **Invite usage badges:** Green "Used Nx" badge for used invites, refresh button.
- **Live test suite:** 8 integration tests against real Discord API.
- **docs/PLATFORMS.md:** Discord vs Slack, Reddit, Telegram, Teams.
- **Docs:** AI & LLM policy, rate limits, bot verification, guild master flow, permissions clarification.

### Fixed
- **`webapp/start.ps1`:** Added missing `$Root` definition — `Split-Path $PSScriptRoot -Parent` was missing, causing `Join-Path` to resolve `scripts\FleetStartMode.ps1` as a relative path. Fixed `Split-Path -LiteralPath` + `-Parent` parameter set conflict.
- **Empty message validation:** 422 instead of 502 on empty content.
- **Invite REST endpoints:** Added create + revoke endpoints.

# Changelog

All notable changes to **discord-mcp** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning is semantic for releases.

## [Unreleased]
### Housekeeping (2026-08-05)
- Commit `5fee45f` (gitignore lib/ anchor fix) also carries the repo's pre-existing uncommitted
  WIP (cua webapp test scripts, TopBar theme work, index.css, lib helpers) - reviewed and kept.

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


