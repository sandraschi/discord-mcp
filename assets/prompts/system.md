# discord-mcp System Guide

## Overview

discord-mcp is a FastMCP 3.2 server that bridges MCP clients (Cursor, Claude Desktop, opencode) to the Discord REST API. It exposes 36+ operations through a single portmanteau tool `discord(operation=...)`, plus an agentic workflow tool and a help tool.

The server runs dual transport: stdio for IDE hosts and streamable HTTP for remote clients. A SOTA web dashboard is available at port 10757 for manual inspection.

## Core Design

All Discord operations are consolidated into one portmanteau tool to avoid context bloat in MCP hosts. The operation parameter acts as a discriminator — the schema shows exactly which params are valid for which operation.

The server handles all Discord API specifics internally:
- Bot token authentication (Bot prefix added automatically)
- Rate limit retry (up to 5 attempts with exponential backoff)
- Server-side anti-spam limits (configurable via env vars)
- Input sanitization (zero-width character stripping, safety boundaries)
- Structured error responses with recovery hints

## Operations Reference

### Guild Operations
- list_guilds — List all guilds the bot has joined
- get_guild_stats(guild_id) — Member count, online count, owner info
- create_guild(name) — Create a new guild (user OAuth2 only)

### Channel Operations
- list_channels(guild_id) — All channels with type (text=0, voice=2, category=4, announcement=5)
- create_channel(guild_id, name, channel_type=0, parent_id) — Create text/voice/announcement channel
- delete_channel(channel_id) — Permanently delete a channel
- list_active_threads(channel_id) — Active threads
- export_messages(channel_id, limit=50) — Channel messages as formatted markdown for Notion/Obsidian
- get_channel_stats(channel_id) — Per-channel statistics

### Message Operations
- send_message(channel_id, content) — Post a message (anti-spam rate limited)
- get_messages(channel_id, limit=50) — Recent messages (max 100)
- edit_message(channel_id, message_id, content) — Edit a bot-sent message
- delete_message(channel_id, message_id) — Delete a message
- create_dm(user_id) — Open DM channel, returns channel_id for messaging

### Moderation Operations
- ban_member(guild_id, user_id, reason, delete_message_seconds) — Ban with optional message purge
- unban_member(guild_id, user_id) — Remove a ban
- kick_member(guild_id, user_id, reason) — Kick a member
- timeout_member(guild_id, user_id, duration_minutes, reason) — Timeout a member
- list_bans(guild_id) — List banned users with reasons
- get_audit_log(guild_id, limit, user_id, action_type) — Filtered audit log entries

### Role Operations
- list_roles(guild_id) — All roles with color, position, permissions
- create_role(guild_id, name) — Create a role
- delete_role(guild_id, role_id) — Delete a role
- assign_role(guild_id, user_id, role_id) — Assign role to member
- remove_role(guild_id, user_id, role_id) — Remove role from member

### Invite Operations
- create_invite(channel_id, max_age=86400, max_uses=0) — Create invite link (max_age in seconds, 0 = never expires)
- list_invites(guild_id) — All active invites
- revoke_invite(invite_code) — Revoke an invite immediately

### Webhook Operations
- list_webhooks(channel_id) — Webhooks in a channel
- create_webhook(channel_id, name) — Create a webhook
- delete_webhook(webhook_id) — Delete a webhook
- execute_webhook(webhook_id, token, content, username, avatar_url) — Post via webhook

### RAG Operations
- rag_ingest(channel_id, limit=50, table_name) — Ingest messages into LanceDB for semantic search
- rag_query(query_text, top_k=10, table_name) — Semantic search over ingested messages

### Utility Operations
- discord_agentic_workflow(goal, ctx) — Multi-step agentic task using LLM sampling
- discord_help(topic) — Returns documentation for any operation area

## Agentic Workflows

The server supports SEP-1577 sampling for multi-step agentic tasks. When a host supports `ctx.sample()`, the agentic workflow can plan tool calls, execute them, and synthesize results. Configuration:

- DISCORD_SAMPLING_BASE_URL — OpenAI-compatible endpoint (default http://127.0.0.1:11434/v1 for Ollama)
- DISCORD_SAMPLING_MODEL — Model name (default llama3.2)
- DISCORD_SAMPLING_USE_CLIENT_LLM=1 — Prefer the MCP host's LLM for sampling

## Environment Variables

DISCORD_TOKEN — Bot token from Discord Developer Portal (primary)
DISCORD_BOT_TOKEN — Fallback if DISCORD_TOKEN not set
PORT — Backend port (default 10756)
DISCORD_SAMPLING_BASE_URL — http://127.0.0.1:11434/v1
DISCORD_SAMPLING_MODEL — llama3.2
DISCORD_RATE_LIMIT_MESSAGES_PER_MINUTE — 10
DISCORD_RATE_LIMIT_MESSAGES_PER_CHANNEL_PER_MINUTE — 3
DISCORD_RATE_LIMIT_CHANNELS_PER_MINUTE — 5
DISCORD_RATE_LIMIT_INVITES_PER_MINUTE — 5
DISCORD_MAX_MESSAGE_LENGTH — 2000
DISCORD_MIN_MESSAGE_INTERVAL_SECONDS — 5.0
DISCORD_COMMS_AUTOSTART — 0
DISCORD_COMMS_CHANNELS — comma-separated channel IDs
DISCORD_COMMS_WEBHOOK_URL — inbound webhook URL
LANCEDB_DISCORD_PATH — LanceDB storage path for RAG
DISCORD_DEEPFANG_PREFLIGHT — 0 (set 1 to gate destructive ops)
DISCORD_TAURI — 1 when running inside Tauri WebView

## Safety

- The server binds to 127.0.0.1 only (no remote access by default)
- Server-side rate limits prevent Discord API bans and abuse
- Destructive operations (ban, kick, delete) can be gated behind DISCORD_DEEPFANG_PREFLIGHT
- All user-facing text from Discord is sanitized with safety boundaries (UNTRUSTED EXTERNAL DATA markers)
- Rate limit errors include the env var to override and current limit
- The bot token never appears in logs or error responses
