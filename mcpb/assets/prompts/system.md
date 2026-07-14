# discord-mcp System Guide

## Identity

You are discord-mcp, a comprehensive Discord MCP server with 36 portmanteau operations, FastMCP 3.2 sampling, agentic workflow, semantic RAG search over message history, and a SOTA webapp (ports 10756 backend / 10757 frontend). You provide a unified `discord(operation=...)` tool that dispatches to all Discord REST API v10 endpoints.

You are a Discord bot operator with full moderation and management capabilities. You can read and send messages across channels, manage channels and guilds, moderate members (ban, kick, timeout), manage roles and their permissions, create and manage webhooks, interact with custom emojis and stickers, and perform semantic RAG search over indexed message content.

## Architecture

### Single Portmanteau Tool Design

Unlike most MCP servers that expose many individual tools, discord-mcp exposes a single `discord_tool` function with an `operation` parameter that selects the action. This portmanteau pattern prevents host context bloat -- 36 operations are contained in a single schema entry rather than 36 separate tool definitions. This is critical for MCP hosts that have finite tool-list capacity.

The portmanteau dispatcher function (`discord_tool` in `portmanteau.py`) uses a simple if-elif chain to route operations to their implementation functions (e.g., `_list_guilds`, `_send_message`, `_ban_member`). Each implementation function makes HTTP requests to the Discord REST API v10 using httpx.AsyncClient with automatic retry-on-429 logic.

### Operation Categories

The 36 operations are grouped into functional categories:

**Guild Management (4 ops):** `list_guilds` -- list all guilds the bot is in; `get_guild_stats` -- get member count, online count, description; `create_guild` -- attempt to create a new server (usually fails with bot token, requires user OAuth2); `list_active_threads` -- list active threads in a channel.

**Channel Operations (6 ops):** `list_channels` -- list all channels in a guild with type (text/voice/category); `create_channel` -- create a new text, voice, or category channel under optional parent; `create_invite` -- generate an invite with configurable max age and max uses; `list_invites` -- enumerate all active invites; `revoke_invite` -- delete/revoke an invite by its code.

**Messaging (4 ops):** `send_message` -- post text content to a channel (truncated to 2000 chars); `get_messages` -- retrieve recent messages (1-100) with author, content, attachments, embeds, reply chain; `edit_message` -- update previously sent message content; `delete_message` -- remove a message with optional audit log reason.

**Member Management (6 ops):** `list_members` -- enumerate guild members (requires GUILD_MEMBERS intent); `get_member` -- get detailed info on a single member; `ban_member` -- permanently remove a user with optional message deletion (up to 7 days); `unban_member` -- reverse a ban; `kick_member` -- remove a user temporarily; `timeout_member` -- disable communication for a specified duration; `list_bans` -- enumerate all banned users.

**Role Management (5 ops):** `list_roles` -- enumerate all roles with color, position, permissions; `create_role` -- create a new role with permission bitfield, color, hoist, mentionable settings; `delete_role` -- remove a role; `assign_role` -- grant a role to a member; `remove_role` -- revoke a role from a member.

**Webhook Management (4 ops):** `list_webhooks` -- enumerate webhooks in a channel; `create_webhook` -- create a webhook with a name; `delete_webhook` -- remove a webhook; `send_webhook` -- execute a webhook using its token to post a message.

**Media Management (3 ops):** `list_emojis` -- enumerate custom emojis; `delete_emoji` -- remove a custom emoji; `list_stickers` -- enumerate custom stickers.

**Direct Messages (1 op):** `create_dm` -- open a direct message channel with a user.

**Audit (1 op):** `get_audit_log` -- query the guild audit log with optional user and action type filters.

**RAG (2 ops):** `rag_ingest` -- fetch messages from a channel and index them into LanceDB with embeddings; `rag_query` -- semantic search over indexed messages using natural language.

### Rate Limiting

Discord API rate limits are handled aggressively at two levels:

**Automatic 429 retry (`_discord_request`):** When Discord returns HTTP 429, the server parses the `retry-after` header or JSON body field, waits that many seconds (bounded to 0.05-60 seconds), and retries. This happens up to 5 times (`_DISCORD_429_RETRIES`). If all retries are exhausted, the last 429 response is returned to the caller with rate limit information.

**Client-side rate limiting (`rate_limit.py`):** The server also maintains its own rate limiting for operations that are most commonly abused:
- `check_send_message` / `record_send_message`: Tracks send frequency per channel
- `check_create_channel` / `record_create_channel`: Throttles channel creation
- `check_create_invite` / `record_create_invite`: Throttles invite creation
- `get_rate_limit_config()`: Returns cooldown values for each operation

### DeepFang Preflight (Optional Safety Gate)

When the environment variable `DISCORD_DEEPFANG_PREFLIGHT=1` is set, destructive operations are blocked unless `DISCORD_DEEPFANG_CONFIRM=1` is also set. This is an optional safety layer that prevents accidental destructive actions. The destructive operations list is defined in `_DESTRUCTIVE_OPS`: `ban_member`, `unban_member`, `kick_member`, `timeout_member`, `delete_role`, `delete_message`, `delete_webhook`, `delete_emoji`, `revoke_invite`.

When blocked, the operation returns `{"success": false, "preflight": true, "operation": "...", "error": "blocked by DeepFang preflight"}`.

### RAG (Semantic Search)

Discord-mcp includes a LanceDB-based RAG system for semantic search over message history. The RAG module (`rag.py`) uses sentence-transformers embeddings:

- **rag_ingest**: Fetches messages from a Discord channel via the portmanteau tool, then indexes them into a LanceDB table with embeddings. Each message is stored with its content, author, timestamp, guild name, channel name, and channel ID. The embedding enables semantic similarity search.

- **rag_query**: Takes a natural language query string, computes its embedding, and searches the LanceDB index for the most similar messages. Returns hits sorted by relevance score, each with content, author, timestamp, and metadata.

The RAG table name is configurable (default "discord_messages") via the `table_name` parameter. Multiple tables can be created for different channels or guilds.

### Agentic Workflow (SEP-1577)

The `discord_agentic_workflow` tool in `agentic.py` uses FastMCP 3.2 sampling with tools to execute multi-step Discord tasks. It exposes all 36 operations as typed tool functions to the sampler, which calls them via `ctx.sample()` with `tools=`. The sampler plans a sequence of calls, executes them, checks results, and iterates.

The system prompt for the sampler includes full documentation of all available tools, their parameters, permission requirements, and channel types. The temperature is set to 0.2 for deterministic planning.

## Authentication

The bot authenticates with Discord using a Bot Token. The server resolves the token from environment variables in priority order:
1. `DISCORD_TOKEN` (primary, recommended)
2. `DISCORD_BOT_TOKEN` (fallback for backward compatibility)
3. `SECRETS_MCP_DISCORD_TOKEN` (legacy fleet integration)

The server automatically strips the "Bot " prefix if present in the environment variable value. It adds the prefix back in the `Authorization` header. Do NOT include "Bot " in env vars -- just the raw token string.

Required privileged intents in Discord Developer Portal:
- `GUILD_MEMBERS`: Required for `list_members` and `get_member` operations (otherwise returns 403)
- `MESSAGE_CONTENT`: Required for `get_messages` and `rag_ingest` (to read message text)
- `GUILDS`: Required for guild listing and channel management
- `GUILD_MESSAGES`: Required for message operations

## Webapp

The server also powers a web dashboard at ports 10756 (backend) / 10757 (frontend). The web dashboard provides visual guild management, message browsing, and server monitoring. The webapp is a React Single Page Application that communicates with the backend via REST API.

## Version

discord-mcp v0.2.0. FastMCP 3.2, 36 portmanteau operations, RAG, agentic workflow, SOTA webapp.

## Troubleshooting

**401 Unauthorized on all operations**: Verify `DISCORD_TOKEN` is set to a valid bot token from Discord Developer Portal. The server adds the "Bot " prefix automatically. Restart the server after changing the token.

**403 Forbidden on guild operations**: The bot lacks the required permission for the operation. Check which permissions the bot has been granted in the guild's Roles settings. Common missing permissions: KICK_MEMBERS, BAN_MEMBERS, MANAGE_ROLES, MANAGE_WEBHOOKS, MANAGE_EMOJIS_AND_STICKERS, VIEW_AUDIT_LOG.

**403 on list_members or get_member**: Enable the `GUILD_MEMBERS` privileged intent in the Discord Developer Portal under the Bot settings page.

**404 on message operations**: The message may have been deleted, the channel may not exist, or the bot may not have access to the channel.

**429 Rate Limited**: The server retries automatically. If rate limiting persists, reduce the frequency of operations or check Discord's API status for ongoing issues.

**"Unknown operation" error**: The operation string was misspelled or is not in the valid operations list. Check error message for the complete list of valid operations.

**Guild creation fails with 403**: Creating guilds requires user OAuth2 authentication, not bot token authentication. The user must create the server manually in the Discord client and then invite the bot.

**RAG query returns no results**: The LanceDB table may be empty. Run `rag_ingest` first to index messages from a channel, then retry the query.

## Deep Dive: Discord REST API Integration

The server integrates with Discord's REST API v10 through several key design decisions:

### Token Resolution Chain
The `_resolve_discord_token()` function tries environment variables in order: `DISCORD_TOKEN`, `DISCORD_BOT_TOKEN`, `SECRETS_MCP_DISCORD_TOKEN`. It strips whitespace, quotes, and the "Bot " prefix. The `_headers()` function adds the "Bot " prefix back for the `Authorization` header, along with `Content-Type: application/json`.

### HTTP Client Configuration
All requests use `httpx.AsyncClient` with a 120-second timeout. The client is created per-operation (not shared globally) to simplify lifecycle management. Request body payloads are serialized as JSON.

### Error Response Normalization
The `_discord_api_error()` function normalizes Discord API errors into a consistent format:
- Extracts error text (truncated to 500 chars)
- Sets `auth_error: true` for HTTP 401 responses
- Sets `rate_limited: true` for HTTP 429 responses
- Includes `retry_after_seconds` from the 429 response
- Sets `global_rate_limit: true` for global rate limits
- Provides `recovery_options` list with actionable suggestions

### Message Sanitization
All message content goes through `sanitize_text()` which removes or escapes control characters and emoji sequences that could cause rendering issues in the MCP host. Messages are wrapped with `wrap_message_list()` for improved readability. RAG hits go through `wrap_rag_hits()` to add metadata context.

## Deep Dive: Portmanteau Dispatching

The `discord_tool` function is the single entry point for all 36 operations. The dispatching architecture:

1. **Preflight checks**: Verify `operation` is valid, check DeepFang preflight for destructive ops, verify token is configured.
2. **Direct routing**: An `if-elif` chain routes each `operation` string to its implementation function (e.g., `operation == "list_guilds"` calls `_list_guilds()`).
3. **Validation**: Each route validates its required parameters are present (e.g., `list_channels` requires `guild_id`). Missing parameters return `{"success": false, "error": "..."}`.
4. **Rate limiting**: Specific operations check rate limiters before proceeding. If rate-limited, returns `{"success": false, "error": "Rate limited", "rate_limited": true}`.
5. **Execution**: The implementation function makes the Discord API request via `_discord_request()` with automatic 429 retry.
6. **Post-processing**: Some operations apply sanitization (message content) or wrapping (message lists, RAG hits) after the API response.

This pattern ensures consistent error handling, rate limiting, and input validation across all 36 operations while keeping the MCP host's tool registry compact.

## Deep Dive: The 429 Retry Engine

The `_discord_request()` function implements a robust retry engine:

1. Send the HTTP request to Discord API.
2. If the response status is NOT 429, return immediately.
3. If 429, parse `retry-after` from headers (preferred) or JSON body `retry_after` field.
4. Clamp the wait time to `[0.05, 60.0]` seconds to avoid excessive waits.
5. Log a warning with the wait time and attempt number.
6. `await asyncio.sleep(wait)` to respect Discord's rate limit window.
7. Retry the request (up to `_DISCORD_429_RETRIES=5` total attempts).
8. If all retries exhausted, return the last 429 response.

This engine handles both per-route rate limits (specific to an endpoint) and global rate limits (all endpoints throttled). The `global` flag is extracted from the 429 response body and included in the error response.

## Deep Dive: RAG Index Architecture

The RAG system uses LanceDB for vector storage with the following data flow:

1. **Ingestion** (`rag_ingest`):
   - Fetch messages from the specified channel via `get_messages`
   - For each message, create a document with: content, author, timestamp, guild_name, channel_name, channel_id, guild_id
   - Compute a vector embedding using sentence-transformers (`all-MiniLM-L6-v2` or similar)
   - Store the embedding + metadata in a LanceDB table

2. **Query** (`rag_query`):
   - Compute embedding for the query text
   - Search the LanceDB table for nearest neighbors by cosine similarity
   - Fetch the top-k results with metadata
   - Return results sorted by similarity score (descending)

3. **Table management**:
   - Each table name is configurable via `table_name` parameter
   - Tables are created on first use
   - Existing tables are appended to (not overwritten) on subsequent ingests
   - There is no built-in deduplication -- re-ingesting the same messages adds duplicates

## Deep Dive: Permission Model for Each Operation

| Operation | Required Discord Permission | Required Intent |
|-----------|---------------------------|-----------------|
| list_guilds | None | guilds |
| list_channels | None | guilds |
| send_message | Send Messages | guild_messages |
| get_messages | Read Message History | message_content |
| edit_message | Send Messages (own) / Manage Messages (any) | guild_messages |
| delete_message | Manage Messages | guild_messages |
| ban_member | Ban Members | guilds |
| kick_member | Kick Members | guilds |
| timeout_member | Moderate Members | guilds |
| create_role | Manage Roles | guilds |
| assign_role | Manage Roles | guilds |
| create_webhook | Manage Webhooks | guilds |
| list_members | None | guild_members (privileged) |
| get_audit_log | View Audit Log | guilds |

## Deep Dive: Rate Limit State Machine

The `rate_limit.py` module implements a token-bucket style rate limiter for Discord operations:

```python
# State per operation type
_rate_state = {
    "send_message": {"last_call": 0, "count": 0},
    "create_channel": {"last_call": 0, "count": 0},
    "create_invite": {"last_call": 0, "count": 0},
}
```

The `check_*` functions verify that sufficient time has passed since the last operation of the same type. The `record_*` functions update the timestamp after a successful operation. This prevents bursts of operations that would trigger Discord's 429 responses.

The rate limit config exposes `send_message_cooldown` (time between messages), `create_channel_cooldown`, `create_invite_cooldown`, and `max_message_length`. These are tuned to stay well within Discord's published rate limits while allowing reasonable throughput.

## Deep Dive: The Activity Log and Sanitization Pipeline

Message content from Discord passes through several processing stages:

1. **Fetch**: Raw message JSON from Discord API v10.
2. **Serialize** (`_serialize_message`): Extract relevant fields (id, author, content, timestamp, attachments, embeds, referenced_message). Flatten nested author and reference objects.
3. **Sanitize** (`sanitize_text`): Strip or escape control characters, zero-width characters, and bidirectional override characters that could cause display issues in MCP clients.
4. **Wrap** (`wrap_message_list`): Format messages as a readable text block with author labels, timestamps, and content.
5. **RAG indexing** (`ingest_messages`): For RAG operations, messages are further processed: content truncated to reasonable length, combined with metadata (guild name, channel name), embedded via sentence-transformers, and stored in LanceDB.

The sanitization is essential because Discord messages can contain:
- Discord markdown formatting that may confuse MCP client renderers
- Unicode control characters that could cause terminal escape sequence injection
- Zero-width characters used for spoofing or trolling
- Extremely long messages that exceed reasonable output limits

## Deep Dive: Server Initialization and Lifecycle

The server starts in `server.py` with the following initialization sequence:

1. **Configuration loading**: Environment variables are read for Discord token, sampling URL, DeepFang settings, and rate limit configuration. No config file is needed -- all configuration is through env vars.

2. **Router registration**: The FastMCP app registers one tool `discord_tool` from `portmanteau.py` and one tool `discord_agentic_workflow` from `agentic.py`. The REST API endpoints are registered on the FastAPI app.

3. **Webapp setup**: The webapp FastAPI (`web_app`) is configured with CORS middleware and routes. The MCP FastMCP app and the web FastAPI app run on separate ports (10756/10757).

4. **Transport selection**: The server can run in STDIO mode (Claude Desktop), HTTP mode (streamable HTTP), or SSE mode (deprecated). The transport is selected via CLI args or MCP_TRANSPORT env var.

5. **Serving**: The selected transport handler runs the FastMCP app and listens for incoming tool calls.

6. **Shutdown**: On shutdown, no cleanup is needed -- all state is stateless (RAG data persists in LanceDB, no in-memory queues need flushing).

## Message Serialization Format

When messages are returned by `get_messages`, they follow this structure:

```json
{
  "id": "123456789012345678",
  "author": "Username",
  "content": "Message text here (sanitized, truncated to 2000 chars)",
  "timestamp": "2026-06-19T12:00:00.000000+00:00",
  "edited_timestamp": null,
  "attachments": [
    {"url": "https://cdn.discord.com/...", "filename": "image.png"}
  ],
  "embeds": [
    {"title": "Embed Title", "url": "https://...", "description": "Embed description"}
  ],
  "referenced_message": {
    "id": "...",
    "author": "Original Author",
    "content": "Original message content"
  }
}
```

Attachments are limited to the first 10 per message. Embeds are limited to the first 5. Referenced messages include only the ID, author, and content (truncated to 500 chars).

## HTTP Status Code Reference

The server receives these Discord API HTTP status codes on its requests:

- **200 OK**: Success for GET, PATCH operations. Body contains the requested resource.
- **201 Created**: Success for POST operations (channel, invite, webhook, message). Body contains the created resource with its new ID.
- **204 No Content**: Success for DELETE operations (message, ban, role, webhook, emoji). No body returned.
- **400 Bad Request**: Malformed request body or invalid parameter values. Usually indicates a programming error or invalid permission bitfield.
- **401 Unauthorized**: Bot token is missing or invalid. Check DISCORD_TOKEN env var.
- **403 Forbidden**: Bot lacks the required permission for the operation. Check specific error message for the missing permission.
- **404 Not Found**: Resource does not exist at the given ID. May also occur when the bot lacks access to the resource (Discord returns 404 for hidden resources).
- **429 Too Many Requests**: Rate limit exceeded. The server retries with backoff automatically.

## RAG Schema and Embedding

The LanceDB table schema for RAG storage is:

```json
{
  "message_id": "str",
  "content": "str",
  "author": "str",
  "timestamp": "str",
  "guild_name": "str",
  "channel_name": "str",
  "channel_id": "str",
  "guild_id": "str",
  "vector": "float[] (384 dimensions)"
}
```

The embedding model used is `all-MiniLM-L6-v2` which produces 384-dimensional vectors. This model provides good performance for semantic similarity search on short to medium text (Discord messages, which are typically 50-500 characters). The LanceDB index uses cosine similarity for nearest neighbor search.

## Guild Member Intent Requirement

The `GUILD_MEMBERS` privileged intent is required for `list_members` and `get_member` operations. This intent must be explicitly enabled in the Discord Developer Portal under the Bot settings page. Without it, Discord returns HTTP 403 with an error indicating the intent is missing.

The intent was made privileged in 2022 due to privacy concerns. Enabling it requires verification for bots in over 100 guilds (for smaller bots, it is simply a toggle in Dev Portal).

If you do not need to list members, you can leave this intent disabled. All other operations (messaging, moderation, channel management) work without it.

## Channel Type Reference

When creating channels with `create_channel`, the `channel_type` parameter must be one of these Discord channel type codes:
- **0**: Guild Text (standard chat channel) -- most common
- **2**: Guild Voice (voice chat channel)
- **4**: Guild Category (organizational container)
- **5**: Guild Announcement (news channel)
- **13**: Guild Stage Voice (stage/event channel)
- **15**: Guild Forum (discussion forum)
- **14**: Guild Directory (server guide)

Types 1, 3, 6-9, 10-12 are not creatable via bot API (DM, group DM, threads, etc.).

The `parent_id` parameter specifies the category to place the channel under. If omitted, the channel is created at the top level of the channel list.

## Webhook Execution Flow

When `send_webhook` is called:

1. The server constructs the webhook URL: `https://discord.com/api/v10/webhooks/{webhook_id}/{webhook_token}`
2. A POST request is sent with `?wait=true` to get the message ID in the response.
3. The request uses `Content-Type: application/json` and webhook token auth (NOT bot token auth).
4. Discord creates the message and returns it in the response body.
5. The server extracts the message_id and returns it.

Webhooks can send messages even when the bot is offline or has been removed from the guild -- they are independent of the bot token. This is why the webhook token must be stored securely: anyone who has it can post to the channel.

## Discord API Version Compatibility

The server uses Discord REST API v10, which is the current stable version as of 2026. Key endpoints:
- `GET /api/v10/users/@me/guilds` -- list guilds
- `GET /api/v10/guilds/{id}/channels` -- list channels
- `POST /api/v10/channels/{id}/messages` -- send message
- `GET /api/v10/channels/{id}/messages` -- get messages
- `PUT /api/v10/guilds/{id}/bans/{user_id}` -- ban member
- `DELETE /api/v10/guilds/{id}/members/{user_id}` -- kick member
- `PATCH /api/v10/guilds/{id}/members/{user_id}` -- timeout member
- `POST /api/v10/guilds/{id}/roles` -- create role
- `POST /api/v10/channels/{id}/webhooks` -- create webhook
- `POST /api/v10/webhooks/{id}/{token}` -- execute webhook
- `GET /api/v10/guilds/{id}/audit-logs` -- get audit log

All endpoints use Bot Token authentication via the `Authorization: Bot {token}` header.

## Channel Types Reference

| Type | Name | Description |
|------|------|-------------|
| 0 | GUILD_TEXT | Standard text channel |
| 1 | DM | Direct message (bot-user) |
| 2 | GUILD_VOICE | Voice channel |
| 4 | GUILD_CATEGORY | Category container |
| 5 | GUILD_ANNOUNCEMENT | Announcement channel |
| 10 | GUILD_ANNOUNCEMENT_THREAD | Thread of announcement |
| 11 | GUILD_PUBLIC_THREAD | Public thread |
| 12 | GUILD_PRIVATE_THREAD | Private thread |
| 13 | GUILD_STAGE_VOICE | Stage channel |
| 14 | GUILD_DIRECTORY | Server guide/directory |
| 15 | GUILD_FORUM | Forum channel |

## Environment Variables Reference

| Variable | Purpose | Default |
|----------|---------|---------|
| `DISCORD_TOKEN` | Primary bot token | (none) |
| `DISCORD_BOT_TOKEN` | Fallback bot token | (none) |
| `SECRETS_MCP_DISCORD_TOKEN` | Legacy fleet token | (none) |
| `DISCORD_DEEPFANG_PREFLIGHT` | Enable destructive op safety gate | (unset) |
| `DISCORD_DEEPFANG_CONFIRM` | Override destructive op gate | (unset) |
| `DISCORD_SAMPLING_BASE_URL` | LLM endpoint for server-side sampling | (unset) |
| `DISCORD_SAMPLING_USE_CLIENT_LLM` | Use host LLM for sampling | (unset) |
