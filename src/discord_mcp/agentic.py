"""Agentic workflow and sampling for Discord (FastMCP 3.2 / SEP-1577).

[DOCSTRING SOTA] — agentic tool uses `Annotated[T, Field(description=...)]`. The docstring
follows the fleet ## Return Format / ## Examples convention.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastmcp import Context
from pydantic import Field

from .portmanteau import discord_tool

logger = logging.getLogger("discord-mcp.agentic")


async def _list_guilds() -> str:
    out = await discord_tool(ctx=None, operation="list_guilds")
    if not out.get("success"):
        return str(out.get("error", out))
    guilds = out.get("guilds", [])
    return "\n".join([f"- {g.get('name')} (id: {g.get('id')})" for g in guilds]) or "No guilds"


async def _list_channels(guild_id: str) -> str:
    out = await discord_tool(ctx=None, operation="list_channels", guild_id=guild_id)
    if not out.get("success"):
        return str(out.get("error", out))
    chans = out.get("channels", [])
    return "\n".join([f"- {c.get('name')} (id: {c.get('id')}, type: {c.get('type')})" for c in chans]) or "No channels"


async def _send_message(channel_id: str, content: str) -> str:
    out = await discord_tool(ctx=None, operation="send_message", channel_id=channel_id, content=content)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Sent message to channel {channel_id} (id: {out.get('message_id')})"


async def _get_messages(channel_id: str, limit: int = 20) -> str:
    out = await discord_tool(ctx=None, operation="get_messages", channel_id=channel_id, limit=limit)
    if not out.get("success"):
        return str(out.get("error", out))
    msgs = out.get("messages", [])
    return "\n".join([f"[{m.get('author')}] {m.get('content')}" for m in msgs]) or "No messages"


async def _get_guild_stats(guild_id: str) -> str:
    out = await discord_tool(ctx=None, operation="get_guild_stats", guild_id=guild_id)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Guild: {out.get('name')} | members: {out.get('member_count')} | online: {out.get('online_count')}"


async def _create_channel(guild_id: str, name: str, channel_type: int = 0, parent_id: str | None = None) -> str:
    out = await discord_tool(
        ctx=None,
        operation="create_channel",
        guild_id=guild_id,
        name=name,
        channel_type=channel_type,
        parent_id=parent_id,
    )
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Created channel {out.get('name')} (id: {out.get('channel_id')}, type: {out.get('type')})"


async def _create_invite(channel_id: str, max_age: int = 86400, max_uses: int = 0) -> str:
    out = await discord_tool(
        ctx=None,
        operation="create_invite",
        channel_id=channel_id,
        max_age=max_age,
        max_uses=max_uses,
    )
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Invite: {out.get('url')} (code: {out.get('code')})"


async def _list_invites(guild_id: str) -> str:
    out = await discord_tool(ctx=None, operation="list_invites", guild_id=guild_id)
    if not out.get("success"):
        return str(out.get("error", out))
    invs = out.get("invites", [])
    return (
        "\n".join([f"- {i.get('code')} uses={i.get('uses')}/{i.get('max_uses')} {i.get('url')}" for i in invs])
        or "No invites"
    )


async def _revoke_invite(invite_code: str) -> str:
    out = await discord_tool(ctx=None, operation="revoke_invite", invite_code=invite_code)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Revoked invite {invite_code}"


async def _list_members(guild_id: str, limit: int = 100) -> str:
    out = await discord_tool(ctx=None, operation="list_members", guild_id=guild_id, limit=limit)
    if not out.get("success"):
        return str(out.get("error", out))
    members = out.get("members", [])
    return "\n".join([f"- {m.get('username')} (id: {m.get('user_id')})" for m in members]) or "No members"


async def _get_member(guild_id: str, user_id: str) -> str:
    out = await discord_tool(ctx=None, operation="get_member", guild_id=guild_id, user_id=user_id)
    if not out.get("success"):
        return str(out.get("error", out))
    return (
        f"Member: {out.get('username')} nick={out.get('nick')} roles={out.get('roles')} joined={out.get('joined_at')}"
    )


async def _edit_message(channel_id: str, message_id: str, content: str) -> str:
    out = await discord_tool(
        ctx=None, operation="edit_message", channel_id=channel_id, message_id=message_id, content=content
    )
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Edited message {message_id} in channel {channel_id}"


async def _delete_message(channel_id: str, message_id: str) -> str:
    out = await discord_tool(ctx=None, operation="delete_message", channel_id=channel_id, message_id=message_id)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Deleted message {message_id} in channel {channel_id}"


async def _create_dm(user_id: str) -> str:
    out = await discord_tool(ctx=None, operation="create_dm", user_id=user_id)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"DM channel created: {out.get('channel_id')}"


async def _ban_member(guild_id: str, user_id: str, delete_message_seconds: int = 0, reason: str = "") -> str:
    out = await discord_tool(
        ctx=None,
        operation="ban_member",
        guild_id=guild_id,
        user_id=user_id,
        delete_message_seconds=delete_message_seconds,
        reason=reason,
    )
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Banned user {user_id} from {guild_id}"


async def _unban_member(guild_id: str, user_id: str) -> str:
    out = await discord_tool(ctx=None, operation="unban_member", guild_id=guild_id, user_id=user_id)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Unbanned user {user_id} from {guild_id}"


async def _kick_member(guild_id: str, user_id: str, reason: str = "") -> str:
    out = await discord_tool(ctx=None, operation="kick_member", guild_id=guild_id, user_id=user_id, reason=reason)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Kicked user {user_id} from {guild_id}"


async def _list_roles(guild_id: str) -> str:
    out = await discord_tool(ctx=None, operation="list_roles", guild_id=guild_id)
    if not out.get("success"):
        return str(out.get("error", out))
    roles = out.get("roles", [])
    return "\n".join([f"- {r.get('name')} (id: {r.get('id')}, color: {r.get('color')})" for r in roles]) or "No roles"


async def _assign_role(guild_id: str, user_id: str, role_id: str) -> str:
    out = await discord_tool(ctx=None, operation="assign_role", guild_id=guild_id, user_id=user_id, role_id=role_id)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Assigned role {role_id} to user {user_id}"


async def _remove_role(guild_id: str, user_id: str, role_id: str) -> str:
    out = await discord_tool(ctx=None, operation="remove_role", guild_id=guild_id, user_id=user_id, role_id=role_id)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Removed role {role_id} from user {user_id}"


async def _list_webhooks(channel_id: str) -> str:
    out = await discord_tool(ctx=None, operation="list_webhooks", channel_id=channel_id)
    if not out.get("success"):
        return str(out.get("error", out))
    whs = out.get("webhooks", [])
    return "\n".join([f"- {w.get('name')} (id: {w.get('id')})" for w in whs]) or "No webhooks"


async def _create_webhook(channel_id: str, webhook_name: str) -> str:
    out = await discord_tool(ctx=None, operation="create_webhook", channel_id=channel_id, webhook_name=webhook_name)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Created webhook {out.get('name')} (id: {out.get('webhook_id')})"


async def _delete_webhook(webhook_id: str) -> str:
    out = await discord_tool(ctx=None, operation="delete_webhook", webhook_id=webhook_id)
    if not out.get("success"):
        return str(out.get("error", out))
    return f"Deleted webhook {webhook_id}"


async def _list_emojis(guild_id: str) -> str:
    out = await discord_tool(ctx=None, operation="list_emojis", guild_id=guild_id)
    if not out.get("success"):
        return str(out.get("error", out))
    emojis = out.get("emojis", [])
    return "\n".join([f"- :{e.get('name')}: (id: {e.get('id')})" for e in emojis]) or "No emojis"


async def _list_stickers(guild_id: str) -> str:
    out = await discord_tool(ctx=None, operation="list_stickers", guild_id=guild_id)
    if not out.get("success"):
        return str(out.get("error", out))
    stickers = out.get("stickers", [])
    return "\n".join([f"- {s.get('name')} (id: {s.get('id')})" for s in stickers]) or "No stickers"


async def _get_audit_log(
    guild_id: str, limit: int = 20, user_id: str | None = None, action_type: int | None = None
) -> str:
    out = await discord_tool(
        ctx=None,
        operation="get_audit_log",
        guild_id=guild_id,
        limit=limit,
        user_id=user_id,
        action_type=action_type,
    )
    if not out.get("success"):
        return str(out.get("error", out))
    entries = out.get("entries", [])
    return (
        "\n".join(
            [
                f"[{e.get('created_at')}] type={e.get('action_type')} user={e.get('user_id')} -> {e.get('target_id')}"
                for e in entries
            ]
        )
        or "No audit log entries"
    )


async def discord_agentic_workflow(
    goal: Annotated[str, Field(description="Natural-language objective (e.g. list channels then summarize activity).")],
    ctx: Context,
) -> dict[str, Any]:
    """DISCORD_AGENTIC_WORKFLOW — Achieve a high-level Discord goal via planning and sampling (SEP-1577).

    PORTMANTEAU PATTERN RATIONALE: Single entry for multi-step Discord tasks without exposing
    dozens of atomic tools to the host; the sampler loops over typed tool functions.

    ## Return Format
    {"success": bool, "message": str (summary), "recommendations": list[str]}

    ## Examples
    discord_agentic_workflow(goal="List all guilds, then list channels in the first one")
    discord_agentic_workflow(goal="Send 'Hello' to the general channel in My Server")
    """

    async def list_guilds() -> str:
        return await _list_guilds()

    async def list_channels(guild_id: str) -> str:
        return await _list_channels(guild_id)

    async def send_message(channel_id: str, content: str) -> str:
        return await _send_message(channel_id, content)

    async def get_messages(channel_id: str, limit: int = 20) -> str:
        return await _get_messages(channel_id, limit)

    async def get_guild_stats(guild_id: str) -> str:
        return await _get_guild_stats(guild_id)

    async def create_channel(guild_id: str, name: str, channel_type: int = 0, parent_id: str | None = None) -> str:
        return await _create_channel(guild_id, name, channel_type, parent_id)

    async def create_invite(channel_id: str, max_age: int = 86400, max_uses: int = 0) -> str:
        return await _create_invite(channel_id, max_age, max_uses)

    async def list_invites(guild_id: str) -> str:
        return await _list_invites(guild_id)

    async def revoke_invite(invite_code: str) -> str:
        return await _revoke_invite(invite_code)

    async def list_members(guild_id: str, limit: int = 100) -> str:
        return await _list_members(guild_id, limit)

    async def get_member(guild_id: str, user_id: str) -> str:
        return await _get_member(guild_id, user_id)

    async def edit_message(channel_id: str, message_id: str, content: str) -> str:
        return await _edit_message(channel_id, message_id, content)

    async def delete_message(channel_id: str, message_id: str) -> str:
        return await _delete_message(channel_id, message_id)

    async def create_dm(user_id: str) -> str:
        return await _create_dm(user_id)

    async def ban_member(guild_id: str, user_id: str, delete_message_seconds: int = 0, reason: str = "") -> str:
        return await _ban_member(guild_id, user_id, delete_message_seconds, reason)

    async def unban_member(guild_id: str, user_id: str) -> str:
        return await _unban_member(guild_id, user_id)

    async def kick_member(guild_id: str, user_id: str, reason: str = "") -> str:
        return await _kick_member(guild_id, user_id, reason)

    async def list_roles(guild_id: str) -> str:
        return await _list_roles(guild_id)

    async def assign_role(guild_id: str, user_id: str, role_id: str) -> str:
        return await _assign_role(guild_id, user_id, role_id)

    async def remove_role(guild_id: str, user_id: str, role_id: str) -> str:
        return await _remove_role(guild_id, user_id, role_id)

    async def list_webhooks(channel_id: str) -> str:
        return await _list_webhooks(channel_id)

    async def create_webhook(channel_id: str, webhook_name: str) -> str:
        return await _create_webhook(channel_id, webhook_name)

    async def delete_webhook(webhook_id: str) -> str:
        return await _delete_webhook(webhook_id)

    async def list_emojis(guild_id: str) -> str:
        return await _list_emojis(guild_id)

    async def list_stickers(guild_id: str) -> str:
        return await _list_stickers(guild_id)

    async def get_audit_log(
        guild_id: str, limit: int = 20, user_id: str | None = None, action_type: int | None = None
    ) -> str:
        return await _get_audit_log(guild_id, limit, user_id, action_type)

    system_prompt = (
        "You are a Discord bot operator with full moderation and management capabilities. "
        "Tools: list_guilds (no args), list_channels(guild_id), "
        "send_message(channel_id, content), get_messages(channel_id, limit optional), "
        "edit_message(channel_id, message_id, content), delete_message(channel_id, message_id), "
        "get_guild_stats(guild_id), create_channel(guild_id, name, channel_type=0, parent_id optional), "
        "create_invite(channel_id, max_age=86400, max_uses=0), list_invites(guild_id), revoke_invite(invite_code), "
        "list_members(guild_id, limit=100), get_member(guild_id, user_id), "
        "create_dm(user_id), ban_member(guild_id, user_id, delete_message_seconds, reason optional), "
        "unban_member(guild_id, user_id), kick_member(guild_id, user_id, reason optional), "
        "list_roles(guild_id), assign_role(guild_id, user_id, role_id), remove_role(guild_id, user_id, role_id), "
        "list_webhooks(channel_id), create_webhook(channel_id, webhook_name), delete_webhook(webhook_id), "
        "list_emojis(guild_id), list_stickers(guild_id), "
        "get_audit_log(guild_id, limit, user_id optional, action_type optional). "
        "Channel types: 0=text, 2=voice, 4=category. "
        "Moderation requires BAN_MEMBERS (ban/unban), KICK_MEMBERS (kick), MODERATE_MEMBERS permission. "
        "Roles require MANAGE_ROLES. Webhooks require MANAGE_WEBHOOKS. Audit log requires VIEW_AUDIT_LOG. "
        "Creating new servers (guilds) is not supported with bot token. "
        "Plan steps; use IDs from list_guilds/list_channels. Summarize."
    )
    try:
        result = await ctx.sample(
            messages=goal,
            system_prompt=system_prompt,
            tools=[
                list_guilds,
                list_channels,
                send_message,
                get_messages,
                edit_message,
                delete_message,
                get_guild_stats,
                create_channel,
                create_invite,
                list_invites,
                revoke_invite,
                list_members,
                get_member,
                create_dm,
                ban_member,
                unban_member,
                kick_member,
                list_roles,
                assign_role,
                remove_role,
                list_webhooks,
                create_webhook,
                delete_webhook,
                list_emojis,
                list_stickers,
                get_audit_log,
            ],
            temperature=0.2,
            max_tokens=1024,
        )
        text = result.text or ""
        return {
            "success": True,
            "message": text or "No response from planner.",
            "recommendations": [
                "Verify DISCORD_TOKEN and intents if operations failed.",
                "For heavy reads, prefer get_messages with a low limit first.",
            ],
        }
    except Exception as e:
        logger.exception("Agentic workflow failed")
        return {
            "success": False,
            "error": str(e),
            "error_type": "agentic_workflow",
            "recovery_options": [
                "Set DISCORD_SAMPLING_BASE_URL and run Ollama for server-side sampling.",
                "Set DISCORD_SAMPLING_USE_CLIENT_LLM=1 to use the host LLM.",
                "Call discord(operation='list_guilds') without agentic to isolate API issues.",
            ],
        }


_runs: dict[str, dict] = {}


def _get_tools_schema() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": "list_guilds",
                "description": "List bot guilds.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_channels",
                "description": "List channels in a guild.",
                "parameters": {
                    "type": "object",
                    "properties": {"guild_id": {"type": "string", "description": "Guild ID"}},
                    "required": ["guild_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "send_message",
                "description": "Send a message to a channel.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "channel_id": {"type": "string", "description": "Channel ID"},
                        "content": {"type": "string", "description": "Message content"},
                    },
                    "required": ["channel_id", "content"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_messages",
                "description": "Get recent messages.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "channel_id": {"type": "string", "description": "Channel ID"},
                        "limit": {"type": "integer", "description": "Max count of messages", "default": 20},
                    },
                    "required": ["channel_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_guild_stats",
                "description": "Get presence and member stats for a guild.",
                "parameters": {
                    "type": "object",
                    "properties": {"guild_id": {"type": "string", "description": "Guild ID"}},
                    "required": ["guild_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_channel",
                "description": "Create text(0), voice(2), or category(4) channel.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "guild_id": {"type": "string", "description": "Guild ID"},
                        "name": {"type": "string", "description": "Channel name"},
                        "channel_type": {"type": "integer", "description": "0=text, 2=voice, 4=category", "default": 0},
                        "parent_id": {"type": "string", "description": "Category ID", "nullable": True},
                    },
                    "required": ["guild_id", "name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_invite",
                "description": "Create an invite code.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "channel_id": {"type": "string", "description": "Channel ID"},
                        "max_age": {"type": "integer", "description": "Seconds till expiry", "default": 86400},
                        "max_uses": {"type": "integer", "description": "Max uses (0=unlimited)", "default": 0},
                    },
                    "required": ["channel_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_invites",
                "description": "List guild invites.",
                "parameters": {
                    "type": "object",
                    "properties": {"guild_id": {"type": "string", "description": "Guild ID"}},
                    "required": ["guild_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "revoke_invite",
                "description": "Revoke an invite code.",
                "parameters": {
                    "type": "object",
                    "properties": {"invite_code": {"type": "string", "description": "Invite code"}},
                    "required": ["invite_code"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_members",
                "description": "List guild members.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "guild_id": {"type": "string", "description": "Guild ID"},
                        "limit": {"type": "integer", "description": "Max members", "default": 100},
                    },
                    "required": ["guild_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_member",
                "description": "Get member detail.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "guild_id": {"type": "string", "description": "Guild ID"},
                        "user_id": {"type": "string", "description": "User ID"},
                    },
                    "required": ["guild_id", "user_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "ban_member",
                "description": "Ban member from guild.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "guild_id": {"type": "string", "description": "Guild ID"},
                        "user_id": {"type": "string", "description": "User ID"},
                        "delete_message_seconds": {
                            "type": "integer",
                            "description": "History clear range",
                            "default": 0,
                        },
                        "reason": {"type": "string", "description": "Reason for ban"},
                    },
                    "required": ["guild_id", "user_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "unban_member",
                "description": "Remove a guild ban.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "guild_id": {"type": "string", "description": "Guild ID"},
                        "user_id": {"type": "string", "description": "User ID"},
                    },
                    "required": ["guild_id", "user_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "kick_member",
                "description": "Kick member from guild.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "guild_id": {"type": "string", "description": "Guild ID"},
                        "user_id": {"type": "string", "description": "User ID"},
                        "reason": {"type": "string", "description": "Reason for kick"},
                    },
                    "required": ["guild_id", "user_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_roles",
                "description": "List guild roles.",
                "parameters": {
                    "type": "object",
                    "properties": {"guild_id": {"type": "string", "description": "Guild ID"}},
                    "required": ["guild_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "assign_role",
                "description": "Add role to a member.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "guild_id": {"type": "string", "description": "Guild ID"},
                        "user_id": {"type": "string", "description": "User ID"},
                        "role_id": {"type": "string", "description": "Role ID"},
                    },
                    "required": ["guild_id", "user_id", "role_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "remove_role",
                "description": "Remove role from a member.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "guild_id": {"type": "string", "description": "Guild ID"},
                        "user_id": {"type": "string", "description": "User ID"},
                        "role_id": {"type": "string", "description": "Role ID"},
                    },
                    "required": ["guild_id", "user_id", "role_id"],
                },
            },
        },
    ]


async def execute_run_loop(run_id: str):
    import asyncio
    import json
    import os

    import httpx

    from .portmanteau import _resolve_discord_token
    from .sampling import DiscordSamplingHandler

    run = _runs[run_id]
    goal = run["goal"]
    messages = [{"role": "system", "content": run["system_prompt"]}, {"role": "user", "content": goal}]

    handler = DiscordSamplingHandler()
    base_url = handler.base_url()
    model = await handler.resolve_default_model()

    status = handler.status()
    if not status["server_side_llm_ready"]:
        run["status"] = "failed"
        run["error"] = "Local Ollama LLM is offline. Start Ollama and run `ollama pull llama3.2`."
        return

    client = httpx.AsyncClient(timeout=120.0)

    destructive_ops = {
        "ban_member",
        "unban_member",
        "kick_member",
        "timeout_member",
        "delete_role",
        "delete_message",
        "delete_webhook",
        "delete_emoji",
        "revoke_invite",
    }

    # Map of tool names to local functions
    tool_map = {
        "list_guilds": _list_guilds,
        "list_channels": _list_channels,
        "send_message": _send_message,
        "get_messages": _get_messages,
        "get_guild_stats": _get_guild_stats,
        "create_channel": _create_channel,
        "create_invite": _create_invite,
        "list_invites": _list_invites,
        "revoke_invite": _revoke_invite,
        "list_members": _list_members,
        "get_member": _get_member,
        "ban_member": _ban_member,
        "unban_member": _unban_member,
        "kick_member": _kick_member,
        "list_roles": _list_roles,
        "assign_role": _assign_role,
        "remove_role": _remove_role,
    }

    max_steps = 10
    step = 0

    while step < max_steps and run["status"] not in ("succeeded", "failed"):
        run["current_step"] = len(run["steps"]) + 1

        payload = {"model": model, "messages": messages, "tools": _get_tools_schema(), "tool_choice": "auto"}

        headers = {"Content-Type": "application/json"}
        _resolve_discord_token()
        key = os.getenv("DISCORD_SAMPLING_API_KEY", "").strip() or os.getenv("OPENAI_API_KEY", "").strip()
        if key:
            headers["Authorization"] = f"Bearer {key}"

        try:
            r = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
            r.raise_for_status()
            res_data = r.json()
        except Exception as e:
            run["status"] = "failed"
            detail = ""
            if isinstance(e, httpx.HTTPStatusError) and e.response is not None:
                detail = f" ({e.response.status_code}: {e.response.text[:200]})"
            run["error"] = f"LLM completion failed: {e}{detail}"
            break

        choice = (res_data.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        tool_calls = msg.get("tool_calls") or []
        content = msg.get("content") or ""

        if not tool_calls:
            run["status"] = "succeeded"
            run["message"] = content
            run["steps"].append({"type": "thought", "text": content, "status": "success"})
            break

        if content:
            run["steps"].append({"type": "thought", "text": content, "status": "success"})

        for tc in tool_calls:
            fn = tc.get("function") or {}
            name = fn.get("name")
            raw_args = fn.get("arguments") or "{}"
            tc_id = tc.get("id")

            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except Exception:
                args = {"raw": raw_args}

            is_destructive = name in destructive_ops

            step_record = {
                "id": tc_id,
                "type": "tool_call",
                "name": name,
                "arguments": args,
                "is_destructive": is_destructive,
                "status": "pending",
            }
            run["steps"].append(step_record)

            if is_destructive:
                run["status"] = "blocked"
                run["pending_tool_call"] = step_record

                # Wait for user approval
                while run["status"] == "blocked":
                    await asyncio.sleep(0.5)

                if run["status"] == "failed":
                    break

            if run["status"] == "running":
                step_record["status"] = "running"
                try:
                    tool_func = tool_map.get(name)
                    if not tool_func:
                        raise ValueError(f"Tool {name} not found")

                    res_val = await tool_func(**args)
                    step_record["status"] = "success"
                    step_record["result"] = res_val

                    messages.append({"role": "assistant", "content": None, "tool_calls": [tc]})
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc_id,
                            "content": json.dumps(res_val) if not isinstance(res_val, str) else res_val,
                        }
                    )
                except Exception as e:
                    step_record["status"] = "error"
                    step_record["result"] = str(e)
                    messages.append({"role": "assistant", "content": None, "tool_calls": [tc]})
                    messages.append({"role": "tool", "tool_call_id": tc_id, "content": f"Error executing tool: {e!s}"})

        step += 1

    await client.close()
