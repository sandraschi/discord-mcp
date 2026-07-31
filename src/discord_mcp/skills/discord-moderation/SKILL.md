# Discord Moderation Skill

## Overview

Moderation workflow for Discord guilds. Covers ban/kick/timeout operations, audit log review, ban list management, and role-based access control.

## Prerequisites

The bot needs these permissions in the guild:
- BAN_MEMBERS — for ban_member, unban_member, list_bans
- KICK_MEMBERS — for kick_member
- MODERATE_MEMBERS — for timeout_member
- VIEW_AUDIT_LOG — for get_audit_log
- MANAGE_ROLES — for role operations

Plus the following privileged intents in Discord Developer Portal:
- GUILD_MEMBERS — required for member lookups

## Workflow: Investigate and Act

### 1. Review Audit Log
Start with recent moderation events:
```
discord(operation="get_audit_log", guild_id="...", limit=20)
```
Filter by action_type (22=ban, 23=unban, 24=kick, 25=timeout) or user_id to narrow.

### 2. Check Current Bans
```
discord(operation="list_bans", guild_id="...")
```
Returns user_id, username, and reason for each ban.

### 3. Take Action

**Ban a spammer:**
```
discord(operation="ban_member", guild_id="...", user_id="...", reason="Spam", delete_message_seconds=86400)
```
delete_message_seconds controls how much history to purge (0-604800 seconds/7 days).

**Kick on first offence:**
```
discord(operation="kick_member", guild_id="...", user_id="...", reason="Warning issued")
```

**Timeout (cool-down):**
```
discord(operation="timeout_member", guild_id="...", user_id="...", duration_minutes=60, reason="Heated discussion")
```

### 4. Manage Roles (Alternative to Moderation)

For minor infractions, consider role-based restrictions instead of bans:
```
discord(operation="list_roles", guild_id="...")
discord(operation="assign_role", guild_id="...", user_id="...", role_id="...")
discord(operation="remove_role", guild_id="...", user_id="...", role_id="...")
```

## Safety

- Destructive operations (ban, delete) can be gated behind `DISCORD_DEEPFANG_PREFLIGHT=1`
- Audit log entries are immutable on Discord's side — always check before acting
- Rate limits apply: 5 channels/min, 5 invites/min, 10 messages/min
