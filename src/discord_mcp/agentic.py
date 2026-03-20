"""Agentic workflow and sampling for Discord (FastMCP 3.1 / SEP-1577)."""
import logging
from typing import Any

from fastmcp import Context

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
    return (
        f"Guild: {out.get('name')} | members: {out.get('member_count')} | online: {out.get('online_count')}"
    )


async def _create_channel(
    guild_id: str, name: str, channel_type: int = 0, parent_id: str | None = None
) -> str:
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
    return "\n".join([f"- {i.get('code')} uses={i.get('uses')}/{i.get('max_uses')} {i.get('url')}" for i in invs]) or "No invites"


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
    return f"Member: {out.get('username')} nick={out.get('nick')} roles={out.get('roles')} joined={out.get('joined_at')}"


async def discord_agentic_workflow(goal: str, ctx: Context) -> dict[str, Any]:
    """DISCORD_AGENTIC_WORKFLOW — Achieve a high-level Discord goal via planning and sampling (SEP-1577).

    PORTMANTEAU PATTERN RATIONALE: Single entry for multi-step Discord tasks without exposing
    dozens of atomic tools to the host; the sampler loops over typed tool functions.

    Args:
        goal: Natural-language objective (e.g. list channels then summarize activity).
        ctx: MCP context for sampling.

    Returns:
        Dict with success, message (summary), optional recommendations.
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

    async def create_channel(
        guild_id: str, name: str, channel_type: int = 0, parent_id: str | None = None
    ) -> str:
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

    system_prompt = (
        "You are a Discord bot operator. Tools: list_guilds (no args), list_channels(guild_id), "
        "send_message(channel_id, content), get_messages(channel_id, limit optional), "
        "get_guild_stats(guild_id), create_channel(guild_id, name, channel_type=0, parent_id optional), "
        "create_invite(channel_id, max_age=86400, max_uses=0), list_invites(guild_id), revoke_invite(invite_code), "
        "list_members(guild_id, limit=100), get_member(guild_id, user_id). "
        "Channel types: 0=text, 2=voice, 4=category. list_members/get_member need GUILD_MEMBERS intent. "
        "Creating new servers (guilds) is not supported with bot token. Plan steps; use IDs from list_guilds/list_channels. Summarize."
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
                get_guild_stats,
                create_channel,
                create_invite,
                list_invites,
                revoke_invite,
                list_members,
                get_member,
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
