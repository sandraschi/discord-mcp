# Web Dashboard & REST API

## Dashboard

**URL:** http://127.0.0.1:10757 (Vite dev server; proxies `/api` → backend **10756**)

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/dashboard` | Health, guild overview, activity |
| Agentic Chat | `/chat` | Sampling-based agentic workflow UI |
| Guilds | `/guilds` | Browse servers |
| Channels | `/channels` | Channel list per guild |
| Invites | `/invites` | Create, list, revoke invites |
| Members | `/members` | Member list (needs GUILD_MEMBERS intent) |
| Messages | `/messages` | Read channel history |
| Send message | `/send` | Post to a channel |
| Favorites | `/favorites` | Saved guild/channel shortcuts |
| Trawl | `/trawl` | Bulk message fetch |
| RAG (LanceDB) | `/rag` | Ingest and semantic search |
| Statistics | `/stats` | Guild/channel stats |
| Tools | `/tools` | Run MCP tools from the browser |
| Skills | `/skills` | Bundled skill previews |
| Apps | `/apps` | Fleet app links |
| Settings | `/settings` | Token, sampling, rate limit display |
| Help | `/help` | In-app help |

Launch full stack: `.\start.ps1` from repo root (or `just serve`).

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

### Guilds & channels

| Method | Path |
|--------|------|
| GET | `/api/v1/guilds` |
| GET | `/api/v1/guilds/{guild_id}/channels` |
| GET | `/api/v1/guilds/{guild_id}/stats` |
| GET | `/api/v1/guilds/{guild_id}/invites` |
| GET | `/api/v1/guilds/{guild_id}/members` |

### Messages & DMs

| Method | Path |
|--------|------|
| GET | `/api/v1/channels/{channel_id}/messages` |
| GET | `/api/v1/channels/{channel_id}/threads` |
| POST | `/api/v1/channels/{channel_id}/messages` |
| PATCH | `/api/v1/channels/{channel_id}/messages/{message_id}` |
| DELETE | `/api/v1/channels/{channel_id}/messages/{message_id}` |
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
