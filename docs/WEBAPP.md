# Web Dashboard & REST API

## Dashboard

**URL:** http://127.0.0.1:10757 (Vite dev server; proxies `/api` → backend **10756**)

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/dashboard` | Health, KPIs (members, channels, intents, RAG), quick actions |
| Agentic Chat | `/chat` | Sampling-based agentic workflow UI |
| Servers | `/guilds` | Catalog: "My servers" vs "Following", curated descriptions, rename server, **global server selection** (persisted; every page follows) |
| Server tree | `/tree` | Category → channel → thread hierarchy, collapsible, copyable ASCII view (threads load lazily on expand) |
| Channels | `/channels` | Channel list + create/edit (name, topic, slowmode)/delete |
| Audit log | `/audit-log` | Decoded moderation/admin history (action labels, actor/target names, timestamps) |
| Invites | `/invites` | Create, list, revoke invites |
| Members | `/members` | Member list + timeout presets (needs GUILD_MEMBERS intent) |
| Messages | `/messages` | Read channel history; edit/delete/pin messages; pinned panel |
| Recents | `/recents` | Latest messages per recently-active channel, paginated cards |
| Send message | `/send` | Post to a channel or DM a member |
| Roles | `/roles` | Roles + channel permission overwrites (allow/inherit/deny matrix) |
| Favorites | `/favorites` | Saved server/channel shortcuts |
| Trawl | `/trawl` | Bulk message fetch |
| RAG (LanceDB) | `/rag` | Ingest and semantic search |
| Statistics | `/stats` | Server/channel stats |
| Tools | `/tools` | Run MCP tools from the browser |
| Skills | `/skills` | Bundled skill previews |
| Apps | `/apps` | Fleet app links |
| Settings | `/settings` | Token, sampling, rate limit display |
| Help | `/help` | In-app help |

Launch full stack: double-click `mcp-central-docs/starts/discord-start.bat`
(or repo-root `start.bat`) and approve one UAC prompt — restarts the
`discord-mcp` NSSM backend with fresh-PID proof, recycles vite, verifies
health on :10756/:10757. Never taskkill the service child.

## REST API

**Base:** http://127.0.0.1:10756 · OpenAPI: http://127.0.0.1:10756/docs

### Core

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Status, `token_set`, rate limits, sampling, `mcp_http_path` |
| GET | `/api/v1/meta` | Tools, prompts, resources, skills |
| GET | `/api/v1/skills` | Skill previews |
| POST | `/api/v1/agentic` | Agentic workflow (HTTP) |
| GET | `/api/v1/providers` | Sampling provider info |

### Servers & channels

| Method | Path |
|--------|------|
| GET | `/api/v1/guilds` |
| GET | `/api/v1/guilds/{guild_id}/channels` (includes `parent_id`) |
| GET | `/api/v1/guilds/{guild_id}/stats` |
| GET | `/api/v1/guilds/{guild_id}/invites` |
| GET | `/api/v1/guilds/{guild_id}/members` |
| GET | `/api/v1/guilds/{guild_id}/recent` (latest per active channel: `limit_channels`, `per_channel`, `offset`) |
| PATCH | `/api/v1/guilds/{guild_id}` (rename, description) |
| GET | `/api/v1/channels/{channel_id}` (includes `permission_overwrites`) |
| PATCH | `/api/v1/channels/{channel_id}` (rename, topic, move to category, position, nsfw, slowmode) |
| PUT | `/api/v1/channels/{channel_id}/permissions/{overwrite_id}` (`allow`/`deny` bitfields or flag names, `overwrite_type`) |
| DELETE | `/api/v1/channels/{channel_id}/permissions/{overwrite_id}` |

### Messages & DMs

| Method | Path |
|--------|------|
| GET | `/api/v1/channels/{channel_id}/messages` |
| GET | `/api/v1/channels/{channel_id}/threads` |
| POST | `/api/v1/channels/{channel_id}/threads` (create thread, optional `message_id`) |
| POST | `/api/v1/channels/{channel_id}/messages` |
| PATCH | `/api/v1/channels/{channel_id}/messages/{message_id}` |
| DELETE | `/api/v1/channels/{channel_id}/messages/{message_id}` |
| GET | `/api/v1/channels/{channel_id}/pins` |
| PUT | `/api/v1/channels/{channel_id}/pins/{message_id}` |
| DELETE | `/api/v1/channels/{channel_id}/pins/{message_id}` |
| POST | `/api/v1/dm` |

### Moderation, roles, webhooks, assets

Routes under `/api/v1/guilds/…` and `/api/v1/channels/…` for bans, kicks, timeouts, roles, webhooks, emojis, stickers, and audit logs — mirror the portmanteau operations. See OpenAPI `/docs` for the full list.

### RAG

| Method | Path |
|--------|------|
| POST | `/api/v1/rag/query` |

## MCP HTTP

Streamable HTTP endpoint for remote MCP clients:

- **URL:** http://127.0.0.1:10756/mcp
- **Discovery:** `GET /api/v1/meta`

Stdio mode (IDE hosts): `uv run python -m discord_mcp.server --mode stdio`

Dual mode (default via `start.ps1`): REST + `/mcp` on port 10756.
