---
name: discord-ops
description: Operate Discord MCP safely — discovery, messaging, channels, invites, and rate limits.
---

# Discord MCP — Operations

Use the portmanteau tool `discord` with `operation` set to one of the REST-backed actions.

## Discovery first

1. `list_guilds` — obtain guild IDs the bot can see.
2. `list_channels` with `guild_id` — map channel IDs and types (0=text, 2=voice, 4=category).

## Messaging

- `send_message` requires `channel_id` and `content`. Server enforces per-minute and per-channel rate limits.
- `get_messages` for recent history; keep `limit` modest on first pass.

## Invites

- `create_invite` on a channel; `list_invites` / `revoke_invite` at guild scope.
- Treat invite URLs as sensitive.

## Members

- `list_members` / `get_member` need the **GUILD_MEMBERS** privileged intent in the Discord Developer Portal.

## Failure modes

- Missing `DISCORD_TOKEN`: all operations fail until set.
- 403 on `create_guild`: expected for bot tokens (user OAuth2 only).
