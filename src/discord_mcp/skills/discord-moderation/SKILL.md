---
name: discord-moderation
description: Ban, kick, timeout, audit log, and role moderation workflows for Discord MCP.
---

# Discord MCP — Moderation

Use `discord(operation=...)` for server moderation. Requires bot permissions on the target guild.

## Permissions map

| Operation | Discord permission |
|-----------|-------------------|
| `ban_member`, `unban_member`, `list_bans` | BAN_MEMBERS |
| `kick_member` | KICK_MEMBERS |
| `timeout_member` | MODERATE_MEMBERS |
| `list_roles`, `create_role`, `delete_role`, `assign_role`, `remove_role` | MANAGE_ROLES |
| `get_audit_log` | VIEW_AUDIT_LOG |

## Recommended workflow

1. `list_guilds` → pick `guild_id`
2. `list_members` or `get_member` → confirm target `user_id`
3. Optional: `get_audit_log` with `limit=20` to review recent actions
4. Apply action with a short `reason` (stored in audit log when supported)

## Ban / unban

```
discord(operation="ban_member", guild_id="...", user_id="...", reason="Spam", delete_message_seconds=86400)
discord(operation="list_bans", guild_id="...", limit=50)
discord(operation="unban_member", guild_id="...", user_id="...")
```

## Kick / timeout

```
discord(operation="kick_member", guild_id="...", user_id="...", reason="Harassment")
discord(operation="timeout_member", guild_id="...", user_id="...", communication_disabled_until="2026-06-09T12:00:00.000Z", reason="Cool down")
```

## Roles

```
discord(operation="list_roles", guild_id="...")
discord(operation="assign_role", guild_id="...", user_id="...", role_id="...")
discord(operation="remove_role", guild_id="...", user_id="...", role_id="...")
```

## Safety

- Destructive ops may be blocked when `DISCORD_DEEPFANG_PREFLIGHT=1` until `DISCORD_DEEPFANG_CONFIRM=1`.
- Message content from `get_messages` is sanitized and wrapped as untrusted data for MCP hosts.
- Always verify guild and user IDs before irreversible actions.

See also: bundled `discord-ops` skill for discovery and messaging basics.
