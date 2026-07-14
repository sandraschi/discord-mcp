# discord-mcp User Guide

## Overview

discord-mcp gives you full Discord bot control through a single unified MCP tool. You can manage guilds, channels, messages, members, roles, webhooks, emojis, and stickers -- plus semantic search over message history -- all through the `discord(operation=...)` portmanteau tool. With 36 operations, this server covers the most common Discord management tasks.

## Getting Started

### Prerequisites

1. A Discord Bot Token from Discord Developer Portal (https://discord.com/developers/applications)
2. The bot invited to at least one guild with appropriate permissions
3. Environment variable set: `DISCORD_TOKEN` (recommended) or `DISCORD_BOT_TOKEN` (fallback)
4. Required intents enabled in Developer Portal: GUILDS, GUILD_MESSAGES, MESSAGE_CONTENT, GUILD_MEMBERS

### Quick Start

```
# List your guilds (servers)
discord(operation="list_guilds")

# List channels in a guild
discord(operation="list_channels", guild_id="123456789012345678")

# Send a message
discord(operation="send_message", channel_id="234567890123456789", content="Hello from Discord MCP!")

# Read recent messages
discord(operation="get_messages", channel_id="234567890123456789", limit=10)
```

### Finding Discord IDs

Discord uses snowflake IDs (19-digit numeric strings) to identify every resource. Enable Developer Mode in Discord settings (Settings > Advanced > Developer Mode) to right-click users, channels, messages, guilds, and roles to copy their IDs. Snowflake IDs are time-sorted -- newer resources have larger IDs.

## Messaging

### Sending Messages

Messages are sent via the Discord REST API. Key behaviors:
- Maximum content length: 2000 characters (truncated automatically)
- Discord markdown formatting is supported: **bold**, *italic*, `code`, > blockquotes, ~~strikethrough~~
- Links are auto-embedded
- @mentions work for users, roles, @everyone, @here
- Emoji shortcodes like `:wave:` render as native Discord emoji
- The bot must have access to the target channel

### Getting Messages

`get_messages` returns the most recent messages in a channel (up to 100 per call). Each message object includes:
- `id`: Discord snowflake
- `author`: Username of the sender
- `content`: Message text (sanitized, truncated to 2000 chars)
- `timestamp`: ISO 8601 timestamp
- `edited_timestamp`: ISO 8601 if edited, null if never edited
- `attachments`: Up to 10 file attachments (url, filename)
- `embeds`: Up to 5 rich embeds (title, url, description)
- `referenced_message`: If this is a reply, the original message data

### Editing Messages

You can only edit messages sent by the bot (or by a webhook the bot controls). To edit another user's message, the bot needs MANAGE_MESSAGES permission. The content is truncated to 2000 characters.

### Deleting Messages

Requires MANAGE_MESSAGES permission. The deletion reason is recorded in the guild audit log. Deleted messages cannot be recovered by any API call -- they are permanently removed from Discord.

## Member Management

### Viewing Members

`list_members` and `get_member` require the `GUILD_MEMBERS` privileged intent enabled in the Discord Developer Portal. Without this intent, Discord returns HTTP 403. The maximum limit for `list_members` is 1000 members per call.

Member objects include: `user_id` (snowflake), `username`, `nick` (display name, null if not set), `roles` (list of role IDs), `joined_at` (ISO 8601 timestamp).

### Moderation Actions

**ban_member**: Permanently removes the user from the guild. Optionally deletes their recent messages (up to 604800 seconds = 7 days back). The ban is recorded in the guild audit log with the provided reason. Requires BAN_MEMBERS permission. Banned users can be re-invited (they are not blocked from receiving invites).

**unban_member**: Removes a ban from a user. The user can rejoin with a new invite. Requires BAN_MEMBERS permission.

**kick_member**: Removes the user temporarily. They can rejoin with a new invite. Requires KICK_MEMBERS permission. Less severe than a ban.

**timeout_member**: Temporarily prevents the user from sending messages, joining voice channels, or reacting. The timeout duration is specified as an ISO 8601 future timestamp (e.g., "2026-07-01T12:00:00Z"). Requires MODERATE_MEMBERS permission. To remove a timeout early, set `communication_disabled_until` to null (not currently exposed -- use a past timestamp).

**Best practices for moderation:**
- Always include a descriptive `reason` parameter for audit trail purposes
- For spam, set `delete_message_seconds` to 86400 (24h) or 604800 (7d)
- Use `timeout_member` for temporary issues before escalating to kick or ban
- List bans with `list_bans` before attempting to unban

## Role Management

### Creating Roles

Roles control permissions in a Discord guild. The `permissions` parameter is a bitfield string. Common permission values:
- Administrator: "8"
- Manage Channels: "16"
- Kick Members: "2"
- Ban Members: "4"
- Manage Messages: "8192"
- Manage Roles: "268435456"
- Moderate Members: "17179869184"
- Manage Webhooks: "536870912"
- Manage Emojis and Stickers: "1073741824"
- View Audit Log: "128"

Use Discord's permission calculator at https://discordapi.com/permissions.html to compute combined bitfields.

The `color` parameter is an RGB integer (0-16777215). Common colors: 16711680 (red), 65280 (green), 255 (blue), 16776960 (yellow), 8947848 (grey).

### Assigning and Removing Roles

The bot must have the MANAGE_ROLES permission. Additionally, the bot's highest role must be positioned above the role being assigned or removed in the Discord role hierarchy.

## Webhooks

Webhooks provide a way to send messages to channels without requiring a bot to be present. Create a webhook, save its ID and token, then use `send_webhook` to post messages.

The webhook URL format is: `https://discord.com/api/webhooks/{webhook_id}/{webhook_token}`

Webhook tokens are sensitive credentials -- they allow anyone who possesses them to post messages to the channel without any bot authentication. Store tokens securely. The webhook functionality is useful for automated messages from CI/CD pipelines, monitoring systems, or external services.

## Direct Messages

To send a DM to a user, first call `create_dm(user_id)` to obtain a DM channel ID, then use `send_message(channel_id, content)` with that channel ID. The bot must share at least one guild with the target user -- if they have no common guilds, Discord returns a 404.

## Audit Log

The audit log records all administrative actions in a guild. Filter by action type (integer code) or by specific user:
- 1: Guild Update, 10: Channel Create, 11: Channel Update, 12: Channel Delete
- 20: Channel Overwrite Create, 22: Channel Overwrite Delete
- 24: Member Kick, 25: Member Prune, 26: Member Ban, 27: Member Unban
- 28: Member Update, 29: Member Role Update
- 30: Member Move, 31: Member Disconnect, 32: Bot Add
- 40: Message Delete, 41: Message Bulk Delete, 42: Message Pin, 43: Message Unpin
- 50: Integration Create, 51: Integration Update, 52: Integration Delete
- 60-62: Stage Instance operations
- 72-74: Sticker operations
- 80-82: Scheduled Event operations
- 100-102: Thread operations

## RAG (Semantic Search)

The RAG system indexes Discord messages using LanceDB with sentence-transformers embeddings for semantic similarity search.

### Indexing Messages
```
discord(operation="rag_ingest", channel_id="...", limit=100, guild_name="My Server", channel_name="general")
```

### Searching Messages
```
discord(operation="rag_query", query_text="discussion about deployment", top_k=10)
```

The RAG system enables natural language discovery of past conversations. Index messages after important discussions to build a searchable knowledge base.

## Agentic Workflow

For complex multi-step tasks, the `discord_agentic_workflow` tool uses FastMCP 3.2 sampling:

```
discord_agentic_workflow(goal="List all guilds, find the general channel in the first one, and read the last 5 messages")
```

Use natural language goals for: checking guilds, moderate members, managing channels, searching history, or auditing activity.

## Example Workflows

### Workflow: Server Audit
1. `discord(operation="list_guilds")` -- identify all servers the bot has access to
2. For each guild: `discord(operation="get_guild_stats", guild_id="...")` -- get member counts and activity
3. `discord(operation="get_audit_log", guild_id="...", limit=50)` -- review recent moderation actions
4. `discord(operation="list_bans", guild_id="...")` -- check all banned users
5. Compile a summary of server health and moderation activity

### Workflow: New Member Onboarding
1. `discord(operation="list_channels", guild_id="...")` -- find the welcome channel
2. `discord(operation="send_message", channel_id="welcome_channel_id", content="Welcome @newuser to the server! Please read the rules in <#rules_channel_id>.")`
3. `discord(operation="assign_role", guild_id="...", user_id="...", role_id="member_role_id")` -- assign the member role
4. `discord(operation="create_invite", channel_id="...", max_age=86400, max_uses=10)` -- create a fresh invite for the user to share

### Workflow: Channel Cleanup
1. `discord(operation="get_messages", channel_id="...", limit=100)` -- get recent messages
2. Identify messages that violate rules (advertising, spam, NSFW)
3. `discord(operation="delete_message", channel_id="...", message_id="...", reason="Rule violation")` -- delete each offending message
4. `discord(operation="timeout_member", guild_id="...", user_id="...", communication_disabled_until="...", reason="Spamming")` -- timeout the offender
5. `discord(operation="send_message", channel_id="...", content="@user has been timed out for rule violations.")` -- announce the action

### Workflow: RAG Knowledge Base
1. `discord(operation="rag_ingest", channel_id="technical-discussions", limit=100, guild_name="Dev Team", channel_name="tech-discussions")`
2. `discord(operation="rag_ingest", channel_id="meeting-notes", limit=100, guild_name="Dev Team", channel_name="meeting-notes")`
3. Later: `discord(operation="rag_query", query_text="deployment process for staging", top_k=5)` -- find relevant past discussions
4. `discord(operation="rag_query", query_text="decision about database migration", top_k=3)` -- find past decisions

### Workflow: Event Channel Setup
1. `discord(operation="create_channel", guild_id="...", name="event-announcements", channel_type=0)` -- text channel for announcements
2. `discord(operation="create_channel", guild_id="...", name="Event Voice", channel_type=2, parent_id="category_id")` -- voice channel under a category
3. `discord(operation="create_role", guild_id="...", name="Event Attendee", color=16776960)` -- yellow role for event participants
4. `discord(operation="create_webhook", channel_id="...", webhook_name="Event Bot")` -- webhook for automated event messages
5. `discord(operation="send_message", channel_id="...", content="@everyone Event starting soon!")` -- announcement

## Common Pitfalls

### Pitfall: Forgetting the `guild_id` or `channel_id`
Most operations require at least one Discord ID. Always call `list_guilds` and `list_channels` first to discover the correct IDs. Snowflake IDs are non-mnemonic -- never guess them.

### Pitfall: Bot lacks required permissions
Moderation operations (ban, kick, timeout) require specific permissions in the Discord guild. If an operation fails with 403, check:
1. Is the permission enabled in Discord Developer Portal for the bot?
2. Is the permission granted in the guild's role settings?
3. Is the bot's role high enough in the role hierarchy?

### Pitfall: Rate limiting due to fast operations
If you call many operations rapidly, you may hit Discord's rate limits. The server retries automatically, but performance degrades. Space operations 1-2 seconds apart for sustained workloads.

### Pitfall: Wrong message_id for edit/delete
Message IDs change when messages are edited (they are immutable -- the ID stays the same actually, but the content changes). Use `get_messages` to obtain the correct message_id before editing or deleting.

### Pitfall: Timeout timestamp format
The `communication_disabled_until` parameter for `timeout_member` must be a valid ISO 8601 timestamp. Use the format `2026-07-01T12:00:00Z` (Z suffix for UTC). If the timestamp is in the past, the timeout is removed early.

### Pitfall: Creating a guild with a bot token
The Discord API returns 403 when a bot token tries to create a guild. This requires user OAuth2 authentication. The bot must be invited to an existing guild -- it cannot create new servers.

## Understanding Discord Snowflake IDs

Snowflake IDs are Discord's unique identifier format. They are 64-bit unsigned integers, typically represented as 17-19 digit decimal strings. The ID encodes the timestamp of creation:

- The first 42 bits represent milliseconds since Discord's epoch (January 1, 2015)
- The next 5 bits represent the internal worker ID
- The next 5 bits represent the internal process ID
- The last 12 bits are an incrementing sequence

This means:
- IDs are roughly sortable by creation time
- Older resources have lower IDs
- You can estimate when a resource was created from its ID
- IDs never repeat (even after the resource is deleted)

The server expects IDs as strings (not integers) to preserve the full precision of 64-bit values.

## Bot Permissions Guide

When inviting the bot to a guild, request these permissions for full functionality:
- **Read Messages / View Channels**: Required for all read operations
- **Send Messages**: Required for send_message, send_webhook
- **Manage Messages**: Required for delete_message, edit_message of other users' messages
- **Read Message History**: Required for get_messages
- **Kick Members**: Required for kick_member
- **Ban Members**: Required for ban_member, unban_member, list_bans
- **Moderate Members**: Required for timeout_member
- **Manage Roles**: Required for create_role, delete_role, assign_role, remove_role
- **Manage Webhooks**: Required for create_webhook, delete_webhook, list_webhooks
- **Manage Emojis and Stickers**: Required for delete_emoji, list_emojis, list_stickers
- **View Audit Log**: Required for get_audit_log
- **Create Invite**: Required for create_invite, list_invites
- **Manage Channels**: Required for create_channel

For the minimal permission set (messaging only): Send Messages, Read Message History, Read Messages/View Channels.

## Invite URL Generation

To invite the bot to a guild, construct a URL with the required permissions:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=PERMISSION_INTEGER&scope=bot
```

Replace `YOUR_CLIENT_ID` with the bot's Application ID from Developer Portal. The `permissions` parameter is the sum of permission bitfields needed. For full admin (if you trust the bot), use `permissions=8` (Administrator).

## Use Cases

### Community Management Bot
Monitor and moderate a community server: set up auto-moderation with get_audit_log, create roles for member tiers, manage channel permissions, create invites for onboarding.

### Support Bot
Track support channels with get_messages, create threads for ticket systems, log moderation actions to audit, use RAG to search past support conversations for solutions.

### Event Management Bot
Create event announcements via send_message, create temporary voice channels for events, manage invite creation for limited-access events, purge channels after events with delete_message.

### Development Team Bot
Create webhooks for CI/CD notifications use send_webhook for build status, index technical discussions with rag_ingest for later semantic search, manage team roles for access control.

## RAG Best Practices

For effective semantic search over message content:

1. **Choose channels wisely**: Index channels that contain substantive discussions, not casual chat. Technical channels, meeting notes channels, and decision-log channels are ideal.

2. **Set meaningful labels**: The `guild_name` and `channel_name` parameters are stored as metadata and shown in search results. Use clear, descriptive names.

3. **Limit scope**: Default to the most recent 50-100 messages when ingesting. For large channels, ingest in batches of 100 messages each.

4. **Re-index periodically**: New messages are not automatically indexed. Re-run `rag_ingest` on important channels periodically to keep the index current.

5. **Use specific queries**: RAG works best with specific queries like "deployment instructions for the API server" rather than "tell me about the project".

6. **Multiple tables**: Use different `table_name` values for different channels or purposes. For example, "support_tickets" for support channel and "dev_discussions" for engineering.

## Webhook Usage Patterns

Webhooks enable external systems to post to Discord without a bot:

**CI/CD pipeline integration:**
```
discord(operation="create_webhook", channel_id="...", webhook_name="CI Bot")
# Save returned webhook_id and webhook_token
# In CI pipeline:
discord(operation="send_webhook", webhook_id="...", webhook_token="...",
        content="Build #42 deployed to production successfully")
```

**Monitoring alerts:**
```
discord(operation="send_webhook", webhook_id="...", webhook_token="...",
        content="🚨 CPU usage above 90% on production server")
```

Webhook messages can include mentions, markdown formatting, and attachments just like regular messages.

## Audit Log Monitoring

Regular audit log checks help maintain guild security:

- Check `action_type=26` (ban) to see who has been banned and by whom
- Check `action_type=24` (kick) to see kicked members
- Check `action_type=29` (role update) to detect unauthorized role changes
- Check `action_type=40` (message delete) to track content removal
- Monitor `action_type=12` (channel delete) for unauthorized channel removals

## File Organization

The discord-mcp server does not create files on disk -- all state is in memory (rate limit counters) or in LanceDB tables (RAG data). The RAG data persists in the LanceDB database directory under the server's working directory. No configuration files, log files, or temporary files are created by the server itself.

## Server Configuration

The discord-mcp server requires minimal configuration. Set the `DISCORD_TOKEN` environment variable with your bot token and start the server. The token is resolved from env vars only -- no config file is needed.

### Transport Configuration
- Default: STDIO mode for Claude Desktop integration
- HTTP mode: Set `MCP_TRANSPORT=http` and `MCP_PORT=10756` for web dashboard integration
- CLI: Use `--http --port 10756` for HTTP mode

### Sampling Configuration
- Server-side: Set `DISCORD_SAMPLING_BASE_URL` to your Ollama endpoint (e.g., `http://127.0.0.1:11434/v1`)
- Client-side: Set `DISCORD_SAMPLING_USE_CLIENT_LLM=1` to use the connected client's LLM

### DeepFang Safety Gate
- Enable: `DISCORD_DEEPFANG_PREFLIGHT=1`
- Confirm: `DISCORD_DEEPFANG_CONFIRM=1` to allow destructive ops after preflight is enabled

## Performance Considerations

Discord API operations have different performance characteristics:

**Fast operations (under 1 second)**: list_guilds, list_channels, send_message, create_invite, list_roles, list_emojis, list_stickers. These are simple GET or POST requests with small payloads.

**Medium operations (1-3 seconds)**: get_messages (with 100 messages), list_members (with 1000 members), ban_member, kick_member, timeout_member, get_audit_log. These involve larger payloads or multiple API calls.

**Rate-limited operations**: create_channel (cooldown enforced), send_message (cooldown per channel), create_invite (cooldown). The server enforces client-side cooldowns to avoid hitting Discord's 429 limits.

**RAG operations (5-30 seconds)**: rag_ingest involves fetching n messages + embedding computation + database write. rag_query involves embedding + similarity search + result formatting. These are the slowest operations due to the ML inference step.

## Discord ID Discovery

To find the IDs needed for operations, enable Developer Mode in Discord (Settings > Advanced > Developer Mode). Then:
- **Guild ID**: Right-click server name in the channel list > Copy ID
- **Channel ID**: Right-click channel name > Copy ID
- **User ID**: Right-click username in member list or chat > Copy ID
- **Message ID**: Right-click message > Copy ID
- **Role ID**: Server Settings > Roles > right-click role > Copy ID
- **Emoji ID**: Right-click custom emoji in emoji picker > Copy ID

IDs are 17-19 digit numeric strings that never change for the lifetime of the resource.

## Common Errors and Quick Fixes

### "Missing Access" Error
Cause: The bot lacks Read Messages permission in the target channel.
Fix: Grant the bot access to the channel or use a channel the bot can see.

### "Cannot send an empty message" Error
Cause: Content was empty or contained only spaces/control characters.
Fix: Ensure content has visible text. Check that sanitization did not remove all content.

### "Invalid Form Body" Error
Cause: One of the parameter values is invalid for Discord's API schema.
Fix: Check parameter types and values. For `channel_type`, valid values are 0, 2, 4. For `color`, range is 0-16777215.

### "Unknown Message" Error
Cause: The message_id does not exist or the bot cannot see it.
Fix: Use `get_messages` to find the correct message_id before editing or deleting.

### "Your message could not be delivered" Error
Cause: The bot cannot send messages to the target (DM was not created, user has DMs disabled).
Fix: For DM failures, the user may have disabled DMs from server members. Use a channel mention instead.

## Integration with Webhooks for Automated Messages

Webhooks provide a way to post messages from external systems without the bot being online. Common patterns:

**CI/CD notifications**: Create a webhook in a builds channel, configure your CI system to POST to the webhook URL on build complete. Use `send_webhook` for testing and manual notifications.

**Monitoring alerts**: Create a webhook in an alerts channel, configure monitoring systems to POST alerts. The webhook can include colored embeds for severity levels.

**Scheduled messages**: Use external cron/scheduler to POST to the webhook URL at scheduled times. The server's `send_webhook` can be used for manual or MCP-triggered scheduled messages.

**Webhook message formatting**: Webhooks support the same markdown formatting as regular messages. They can also include embeds (rich card-style messages). The `send_webhook` tool only supports plain text content currently.

## Discord Markdown Formatting Reference

When sending messages, use Discord markdown for formatting:

| Style | Syntax | Example Output |
|-------|--------|---------------|
| Bold | `**text**` | **text** |
| Italic | `*text*` or `_text_` | *text* |
| Strikethrough | `~~text~~` | ~~text~~ |
| Underline | `__text__` | underline (if supported by client) |
| Inline code | `` `code` `` | `code` |
| Code block | ` ```language ... ``` ` | Formatted code block |
| Block quote | `> text` | Quoted paragraph |
| Block quote (multi) | `>>> text` | Multi-paragraph quote |
| Spoiler | `||text||` | Click-to-reveal spoiler |
| Link | `[text](url)` | Clickable link |
| Emoji | `:emoji:` | Discord emoji (::emoji::) |
| User mention | `<@USER_ID>` | @Username |
| Channel mention | `<#CHANNEL_ID>` | #channel-name |
| Role mention | `<@&ROLE_ID>` | @Role name |
| Timestamp | `<t:UNIX_SECONDS>` | Formatted date/time |

## Channel Organization Patterns

Organizing channels effectively improves guild navigation and member experience:

**Category-based organization**: Create categories for different topics (e.g., "General", "Development", "Support", "Off-Topic"). Use `create_channel` with `channel_type=4` for categories, then create text/voice channels with `parent_id` set to the category ID.

**Channel naming conventions**: Use consistent prefixes:
- Text channels: `general`, `announcements`, `support`, `development`, `design`
- Voice channels: `General Voice`, `Music`, `Gaming`, `Meeting Room`
- Prefix by purpose: `dev-`, `support-`, `social-`, `proj-`

**Channel topic descriptions**: Set channel topics via the Discord client to describe each channel's purpose. The API does not directly support setting topics through this server, but they can be set manually.

## Invite Management Best Practices

Discord invites require careful management to prevent unwanted access:

**Temporary invites**: Use `max_age` (seconds) and `max_uses` to create temporary or limited-use invites. This is more secure than permanent zero-limit invites. For event access, use `max_age=86400` (24h) and `max_uses=50`.

**Invite revocation**: Regularly audit invites with `list_invites(guild_id)` and revoke unused ones with `revoke_invite(code)`. Old invites that are never used are a security risk.

**Vanity invites**: Discord servers with Boost Level 3 can have custom vanity URLs (e.g., discord.gg/customname). These cannot be created or managed through the API. Use the Discord client for vanity URL management.

## Understanding Rate Limit Response Headers

When Discord rate limits the bot, the 429 response includes these headers:
- `Retry-After`: Seconds to wait before retrying (used by the server's retry engine)
- `X-RateLimit-Global`: Present if this is a global rate limit (affects all endpoints)
- `X-RateLimit-Scope`: Indicates whether the limit is per-route ("user") or shared ("global")

The server parses both the `Retry-After` header and the JSON response body's `retry_after` field. The header is preferred when available; the JSON field is used as fallback.

## Rate Limiting Deep Dive

Discord rate limits operate at multiple levels and the server handles each:

### Per-Route Rate Limits
Each API endpoint has its own limit (e.g., X requests per Y seconds). The server's 429 retry engine handles these automatically. Common per-route limits:
- Send message: 5 per 5 seconds per channel
- Create channel: 10 per 10 seconds per guild
- Delete message: 5 per 5 seconds per channel
- Ban/kick: 1 per 1 second per guild

### Global Rate Limits
When Discord's entire API is under load, it may return global 429s (indicated by `"global": true` in the response). The server treats these the same as per-route limits but logs them with `global_rate_limit: true`.

### Rate Limit Headers
The server reads these Discord response headers for rate limit information:
- `X-RateLimit-Limit`: Maximum requests in the window
- `X-RateLimit-Remaining`: Requests remaining in the window
- `X-RateLimit-Reset`: When the window resets (Unix timestamp)
- `X-RateLimit-Reset-After`: Seconds until the window resets
- `X-RateLimit-Bucket`: Rate limit bucket identifier
- `X-RateLimit-Global`: Present only for global rate limits

### Avoiding Rate Limits
- Space operations 1-2 seconds apart for sustained workloads
- Use limit=50-100 maximum for listing operations
- Avoid creating many channels or invites in rapid succession
- Use `get_messages` with moderate limits (10-50) for routine checks

## Cross-Tool Integration

discord-mcp integrates naturally with other fleet MCP tools:

- **email-mcp**: Forward important Discord messages to email for archival
- **gitops**: Post PR notifications and CI/CD status to Discord channels
- **suno-mcp**: Announce new music track generations in a music channel
- **monitoring-mcp**: Send server monitoring alerts to an alerts channel
- **aiwatcher-mcp**: Forward digests and alerts to Discord for review

Example: Set up a CI/CD notification pipeline:
1. Create a webhook with `create_webhook(channel_id, "CI Bot")`
2. Configure CI system to POST build status to the webhook URL
3. Use `send_webhook(webhook_id, webhook_token, content="Build passed!")` for test notifications
4. Monitor the channel for build status updates

## Understanding Permissions in Discord

### Permission Hierarchy
1. @everyone role (base permissions)
2. Role permissions (highest role takes priority for role-specific actions)
3. Channel-specific permission overwrites
4. The bot's permissions are the intersection of its role and the channel overwrites

### Common Permission Issues
- "Cannot execute action on a member with a higher role": The bot's highest role must be ABOVE the target user's highest role. Move the bot's role up in the server settings role list.
- "Missing Access": The bot does not have Read Messages permission for the target channel. Grant the bot access to the channel.
- "This action requires MANAGE_MESSAGES permission": The bot can only delete other users' messages if it has MANAGE_MESSAGES. Without it, it can only delete its own messages.

## Advanced RAG Usage

### Creating Separate Knowledge Bases
Use different `table_name` values to create separate searchable knowledge bases:
- `table_name="support_tickets"` -- customer support channel messages
- `table_name="team_discussions"` -- internal team chat
- `table_name="meeting_notes"` -- scheduled meeting notes channel
- `table_name="code_reviews"` -- code review discussion channel

### Re-indexing Strategy
Messages are not automatically re-indexed. Set up a periodic re-indexing schedule:
- High-traffic channels: re-index daily (last 100 messages)
- Medium-traffic channels: re-index weekly
- Low-traffic channels: re-index monthly

### Query Optimization
For better semantic search results:
- Use specific, multi-word queries: "deployment process for the payment service" vs "deployment"
- Include key terms you remember from the conversation
- Try different phrasings if the first query returns poor results
- Use `top_k=20` for exploratory queries, `top_k=5` for focused searches

## Message Content Limits

Discord imposes limits on message content and the server enforces them:

| Field | Server Limit | Discord Limit |
|-------|-------------|---------------|
| Message content | 2000 chars | 2000 chars |
| Audit log reason | 512 chars | 512 chars |
| Channel name | 100 chars | 100 chars |
| Role name | 100 chars | 100 chars |
| Webhook name | 80 chars | 80 chars |
| Invite max_age | 604800s (7d) | 604800s |
| Invite max_uses | 100 | 100 |
| delete_message_seconds | 604800s (7d) | 604800s |
| get_messages limit | 100 | 100 |
| list_members limit | 1000 | 1000 |

## Session and Connection Management

The Discord REST API is stateless -- each operation is an independent HTTP request. There is no persistent connection or WebSocket. The bot token is the only authentication needed. The server does not maintain any long-lived connection to Discord.

However, the server does have in-memory rate limit state that is reset on server restart. After restarting, rate limit counters start from zero, which may cause a brief burst of operations before the counters catch up.

## Error Handling

All operations return structured JSON with a `success` boolean:

### Common HTTP Status Codes and Their Meanings
- **200**: Success. The request completed as expected.
- **201**: Created. Resource was successfully created (channel, invite, webhook, DM).
- **204**: Success with no body. Typical for DELETE operations (message, ban, role).
- **401**: Unauthorized. The bot token is invalid or missing. Check DISCORD_TOKEN.
- **403**: Forbidden. The bot lacks the required permission for this operation. Check the specific error message for which permission is needed.
- **404**: Not Found. The resource (channel, guild, message, user) does not exist or the bot cannot access it. Verify the ID.
- **429**: Rate Limited. Discord is throttling the bot. The server retries automatically with backoff. If persistent, reduce operation frequency.

### Response Fields
- `success`: Boolean indicator of operation success.
- `error`: Present only on failure, containing a human-readable error message.
- `auth_error`: Set to `true` when the token is invalid or missing.
- `rate_limited`: Set to `true` when a 429 was encountered and retries failed.
- `retry_after_seconds`: Present on 429 errors, indicating the suggested wait time.
- `global_rate_limit`: Set to `true` for Discord's global rate limit (all endpoints throttled).
- `recovery_options`: A list of suggested actions to resolve the error.
- `preflight`: Set to `true` when blocked by DeepFang safety gate (see below).

### DeepFang Safety Gate
When `DISCORD_DEEPFANG_PREFLIGHT=1`, destructive operations are blocked unless `DISCORD_DEEPFANG_CONFIRM=1`. Blocked operations return:
```json
{
  "success": false,
  "error": "Destructive operation 'ban_member' blocked by DeepFang preflight...",
  "preflight": true,
  "operation": "ban_member"
}
```
To allow the operation, set `DISCORD_DEEPFANG_CONFIRM=1` and restart, or disable preflight entirely.

