# Discord Ops Skill

## Overview

Core operations for Discord server management via the `discord(operation=...)` portmanteau tool. Covers guild browsing, channel management, messaging, moderation, roles, invites, webhooks, and RAG search.

## Key Operations

### Discovery
- `discord(operation="list_guilds")` — All guilds the bot has joined. Start here.
- `discord(operation="list_channels", guild_id="...")` — Browse channels in a guild.

### Messaging
- `discord(operation="send_message", channel_id="...", content="...")` — Post a message. Subject to anti-spam limits (10/min global, 3/min per channel, 5s interval).
- `discord(operation="get_messages", channel_id="...", limit=50)` — Recent messages.
- `discord(operation="edit_message", channel_id="...", message_id="...", content="...")` — Edit bot messages only.
- `discord(operation="delete_message", channel_id="...", message_id="...")` — Delete bot messages.

### Moderation
- `discord(operation="ban_member", guild_id="...", user_id="...", reason="...", delete_message_seconds=0)` — Ban with optional message purge.
- `discord(operation="unban_member", guild_id="...", user_id="...")` — Lift a ban.
- `discord(operation="kick_member", guild_id="...", user_id="...", reason="...")` — Kick a member.
- `discord(operation="timeout_member", guild_id="...", user_id="...", duration_minutes=60, reason="...")` — Timeout member.
- `discord(operation="list_bans", guild_id="...")` — List banned users.
- `discord(operation="get_audit_log", guild_id="...", limit=50)` — Fetch audit log.

### Channel Management
- `discord(operation="create_channel", guild_id="...", name="...", channel_type=0)` — type: 0=text, 2=voice, 5=announcement.
- `discord(operation="delete_channel", channel_id="...")` — Permanent delete.
- `discord(operation="export_messages", channel_id="...", limit=50)` — Markdown export.

### Roles
- `discord(operation="list_roles", guild_id="...")` — All roles with colors/positions.
- `discord(operation="create_role", guild_id="...", name="...")` — New role.
- `discord(operation="delete_role", guild_id="...", role_id="...")` — Delete role.
- `discord(operation="assign_role", guild_id="...", user_id="...", role_id="...")` — Assign.
- `discord(operation="remove_role", guild_id="...", user_id="...", role_id="...")` — Remove.

### Invites
- `discord(operation="create_invite", channel_id="...", max_age=86400, max_uses=0)` — Create invite (max_age seconds, 0=never).
- `discord(operation="list_invites", guild_id="...")` — Active invites.
- `discord(operation="revoke_invite", invite_code="...")` — Revoke.

### RAG
- `discord(operation="rag_ingest", channel_id="...", limit=50)` — Index messages for semantic search.
- `discord(operation="rag_query", query_text="...", top_k=10)` — Search indexed messages.

## Workflow Order

For moderation: list guilds → get audit log → identify offending user → ban/kick/timeout → verify with list_bans.

For content review: list guilds → list channels → get_messages → export_messages or rag_ingest → rag_query.

## Env Dependencies

DISCORD_TOKEN — Required. Rate limits configured via DISCORD_RATE_LIMIT_* vars.
