# MCP Tool Reference

## Tools overview

| Tool | Purpose |
|------|---------|
| `discord` | Portmanteau — all Discord REST operations via `operation=` |
| `discord_help` | Multi-level help by category and topic |
| `discord_agentic_workflow` | High-level goal via sampling + tool calls (SEP-1577) |

## `discord(operation=…)`

Single entry point for **36 operations**. Returns `{"success": bool, …}` with operation-specific fields or `error` on failure.

### Discovery

| Operation | Key parameters |
|-----------|----------------|
| `list_guilds` | — |
| `list_channels` | `guild_id` |
| `list_members` | `guild_id`, `limit` (needs **GUILD_MEMBERS** intent) |
| `get_member` | `guild_id`, `user_id` |
| `get_guild_stats` | `guild_id` |
| `list_active_threads` | `channel_id` |

### Messaging

| Operation | Key parameters |
|-----------|----------------|
| `send_message` | `channel_id`, `content` |
| `get_messages` | `channel_id`, `limit` |
| `edit_message` | `channel_id`, `message_id`, `content` |
| `delete_message` | `channel_id`, `message_id`, `reason` |
| `create_dm` | `user_id` |

### Channels & invites

| Operation | Key parameters |
|-----------|----------------|
| `create_channel` | `guild_id`, `name`, `channel_type`, `parent_id` |
| `create_guild` | `name` (requires user OAuth2 — bot gets 403) |
| `create_invite` | `channel_id`, `max_age`, `max_uses` |
| `list_invites` | `guild_id` |
| `revoke_invite` | `invite_code` |

### Moderation

| Operation | Key parameters |
|-----------|----------------|
| `ban_member` | `guild_id`, `user_id`, `reason`, `delete_message_seconds` |
| `unban_member` | `guild_id`, `user_id`, `reason` |
| `kick_member` | `guild_id`, `user_id`, `reason` |
| `timeout_member` | `guild_id`, `user_id`, `communication_disabled_until`, `reason` |
| `list_bans` | `guild_id`, `limit` |
| `get_audit_log` | `guild_id`, `limit`, `action_type`, `user_id` |

### Roles

| Operation | Key parameters |
|-----------|----------------|
| `list_roles` | `guild_id` |
| `create_role` | `guild_id`, `name`, `permissions`, `color`, `hoist`, `mentionable` |
| `delete_role` | `guild_id`, `role_id` |
| `assign_role` | `guild_id`, `user_id`, `role_id` |
| `remove_role` | `guild_id`, `user_id`, `role_id` |

### Webhooks

| Operation | Key parameters |
|-----------|----------------|
| `list_webhooks` | `channel_id` |
| `create_webhook` | `channel_id`, `webhook_name` |
| `delete_webhook` | `webhook_id` |
| `send_webhook` | `webhook_id`, `webhook_token`, `content` |

### Guild assets

| Operation | Key parameters |
|-----------|----------------|
| `list_emojis` | `guild_id` |
| `delete_emoji` | `guild_id`, `emoji_id`, `reason` |
| `list_stickers` | `guild_id` |

### RAG (LanceDB)

| Operation | Key parameters |
|-----------|----------------|
| `rag_ingest` | `channel_id`, `guild_name`, `channel_name`, `table_name`, `limit` |
| `rag_query` | `query_text`, `table_name`, `top_k` |

### Examples

```
discord(operation="list_guilds")
discord(operation="send_message", channel_id="123", content="Hello!")
discord(operation="ban_member", guild_id="456", user_id="789", reason="Spam")
discord(operation="get_audit_log", guild_id="456", limit=20)
discord(operation="rag_query", query_text="deployment decision", top_k=5)
```

## `discord_help`

```
discord_help(category="operations")
discord_help(category="moderation", topic="ban_member")
```

## `discord_agentic_workflow`

```
discord_agentic_workflow(goal="List guilds and post a status ping to #general")
```

Returns a structured dict: `success`, `message`, `recommendations` (or error fields).

## Prompts

Registered MCP prompts:

- `discord_quick_start`
- `discord_diagnostics`
- `discord_moderation_playbook`
- `discord_rag_workflow`
- `discord_invite_operations`

## Skills

Bundled under `src/discord_mcp/skills/` — exposed as MCP resources (`skill://`):

| Skill | Focus |
|-------|-------|
| `discord-ops` | Safe discovery, messaging, invites, rate limits |
| `discord-rag` | Ingest and semantic search over channel history |

Listed in dashboard **Skills** and via `GET /api/v1/skills`.

## Resources

- `resource://discord-mcp/capabilities` — short capability summary for clients
