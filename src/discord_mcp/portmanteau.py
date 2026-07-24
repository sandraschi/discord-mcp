"""Portmanteau tool discord(operation=...) for Discord (FastMCP 3.2). Uses Discord REST API."""

import asyncio
import logging
import os
from typing import Annotated

import httpx
from fastmcp import Context
from pydantic import Field

from .rag import ingest_messages, rag_query_async
from .rate_limit import (
    check_create_channel,
    check_create_invite,
    check_send_message,
    get_rate_limit_config,
    record_create_channel,
    record_create_invite,
    record_send_message,
)
from .sanitize import sanitize_text, wrap_message_list, wrap_rag_hits

logger = logging.getLogger("discord-mcp.portmanteau")

DISCORD_API = "https://discord.com/api/v10"
_DISCORD_HTTP_TIMEOUT = 120.0
_DISCORD_429_RETRIES = 5


def _resolve_discord_token() -> str:
    """Resolve Discord token from supported env vars with normalization."""
    # Primary token used by this server; fallback keeps compatibility with older setups.
    raw = (
        os.environ.get("DISCORD_TOKEN")
        or os.environ.get("DISCORD_BOT_TOKEN")
        or os.environ.get("SECRETS_MCP_DISCORD_TOKEN")
        or ""
    ).strip()
    if not raw:
        return ""
    # Handle common paste issues from .env/UI input.
    token = raw.strip().strip("\"'").strip()
    if token.lower().startswith("bot "):
        token = token[4:].strip()
    return token


_DESTRUCTIVE_OPS = frozenset(
    {
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
)


def _destructive_preflight_block(operation: str) -> dict | None:
    """Optional DeepFang gate for destructive Discord ops (env DISCORD_DEEPFANG_PREFLIGHT=1)."""
    if operation not in _DESTRUCTIVE_OPS:
        return None
    flag = os.environ.get("DISCORD_DEEPFANG_PREFLIGHT", "").strip().lower()
    if flag not in ("1", "true", "yes"):
        return None
    confirm = os.environ.get("DISCORD_DEEPFANG_CONFIRM", "").strip().lower()
    if confirm in ("1", "true", "yes"):
        return None
    return {
        "success": False,
        "error": (
            f"Destructive operation '{operation}' blocked by DeepFang preflight. "
            "Set DISCORD_DEEPFANG_CONFIRM=1 to allow."
        ),
        "preflight": True,
        "operation": operation,
    }


def _retry_after_seconds(r: httpx.Response) -> float:
    """Seconds to wait from Discord 429 (header or JSON body)."""
    h = (r.headers.get("retry-after") or r.headers.get("Retry-After") or "").strip()
    if h:
        try:
            return float(h)
        except ValueError:
            pass
    try:
        j = r.json()
        if isinstance(j, dict) and "retry_after" in j:
            return float(j["retry_after"])
    except Exception:
        logger.debug("Could not parse retry-after from 429 response body")
    return 1.0


async def _discord_request(client: httpx.AsyncClient, method: str, url: str, **kwargs) -> httpx.Response:
    """Perform request; on HTTP 429 wait per Discord and retry (bounded)."""
    last: httpx.Response | None = None
    for attempt in range(_DISCORD_429_RETRIES):
        last = await client.request(method, url, **kwargs)
        if last.status_code != 429:
            return last
        if attempt >= _DISCORD_429_RETRIES - 1:
            break
        wait = min(max(_retry_after_seconds(last), 0.05), 60.0)
        logger.warning(
            "Discord API 429; waiting %.2fs then retry %s/%s",
            wait,
            attempt + 2,
            _DISCORD_429_RETRIES,
        )
        await asyncio.sleep(wait)
    assert last is not None
    return last


def _discord_api_error(r: httpx.Response) -> dict:
    """Structured failure for Discord REST errors (429 includes retry hints)."""
    err = r.text[:500]
    out: dict = {"success": False, "error": f"Discord API {r.status_code}: {err}"}
    if r.status_code == 401:
        out["auth_error"] = True
        out["recovery_options"] = [
            (
                "Verify DISCORD_TOKEN (or DISCORD_BOT_TOKEN fallback) is a current "
                "bot token from Discord Developer Portal."
            ),
            "Do not include the 'Bot ' prefix in env values; the server adds it automatically.",
            "Restart the server after updating env vars so changes are applied.",
        ]
    if r.status_code == 429:
        out["rate_limited"] = True
        out["discord_api_rate_limit"] = True
        try:
            j = r.json()
            if isinstance(j, dict):
                if "retry_after" in j:
                    out["retry_after_seconds"] = float(j["retry_after"])
                if j.get("global") is True:
                    out["global_rate_limit"] = True
        except Exception:
            logger.debug("Could not parse error body for 429 details")
    return out


def _headers() -> dict:
    token = _resolve_discord_token()
    if not token:
        return {}
    return {"Authorization": f"Bot {token}", "Content-Type": "application/json"}


async def discord_tool(
    ctx: Context | None = None,
    operation: Annotated[
        str,
        Field(
            description="Discord operation to perform.",
            examples=[
                "list_guilds",
                "list_channels",
                "send_message",
                "get_messages",
                "edit_message",
                "delete_message",
                "export_messages",
                "list_active_threads",
                "get_guild_stats",
                "create_channel",
                "delete_channel",
                "create_guild",
                "create_invite",
                "list_invites",
                "revoke_invite",
                "list_members",
                "get_member",
                "ban_member",
                "unban_member",
                "kick_member",
                "timeout_member",
                "list_bans",
                "create_dm",
                "list_roles",
                "create_role",
                "delete_role",
                "assign_role",
                "remove_role",
                "list_webhooks",
                "create_webhook",
                "delete_webhook",
                "send_webhook",
                "list_emojis",
                "delete_emoji",
                "list_stickers",
                "get_audit_log",
                "rag_ingest",
                "rag_query",
            ],
        ),
    ] = "list_guilds",
    guild_id: Annotated[str | None, Field(description="Discord guild (server) snowflake ID.")] = None,
    channel_id: Annotated[str | None, Field(description="Discord channel snowflake ID.")] = None,
    content: Annotated[str | None, Field(description="Message content for send/edit/webhook.")] = None,
    limit: Annotated[int, Field(description="Max results (1-100 for messages, 1-1000 for members/audit).", ge=1)] = 50,
    name: Annotated[
        str | None, Field(description="Name for create_channel, create_guild, create_role, create_webhook.")
    ] = None,
    channel_type: Annotated[int, Field(description="Channel type: 0=text, 2=voice, 4=category.", ge=0, le=15)] = 0,
    parent_id: Annotated[str | None, Field(description="Parent category ID for create_channel.")] = None,
    invite_code: Annotated[str | None, Field(description="Invite code to revoke (not full URL).")] = None,
    max_age: Annotated[int, Field(description="Invite max age in seconds (0-604800).", ge=0, le=604800)] = 86400,
    max_uses: Annotated[int, Field(description="Invite max uses (0=unlimited, max 100).", ge=0, le=100)] = 0,
    user_id: Annotated[
        str | None, Field(description="Discord user snowflake ID for get_member, ban, kick, DM, timeout.")
    ] = None,
    message_id: Annotated[str | None, Field(description="Discord message snowflake ID for edit/delete.")] = None,
    reason: Annotated[str, Field(description="Audit log reason for ban/kick/timeout.")] = "",
    delete_message_seconds: Annotated[
        int, Field(description="Delete messages from past N seconds on ban (0-604800).", ge=0, le=604800)
    ] = 0,
    communication_disabled_until: Annotated[
        str | None,
        Field(description="ISO 8601 timestamp to disable communication until (timeout)."),
    ] = None,
    role_id: Annotated[str | None, Field(description="Role snowflake ID for role operations.")] = None,
    permissions: Annotated[str, Field(description="Permission bitfield string for create_role.")] = "0",
    color: Annotated[int, Field(description="RGB color for role (0=default).", ge=0, le=16777215)] = 0,
    hoist: Annotated[bool, Field(description="Display role members separately from online users.")] = False,
    mentionable: Annotated[bool, Field(description="Allow anyone to @mention this role.")] = False,
    webhook_id: Annotated[str | None, Field(description="Webhook ID for delete/send operations.")] = None,
    webhook_token: Annotated[str | None, Field(description="Webhook token for send_webhook (execute).")] = None,
    webhook_name: Annotated[str, Field(description="Name for create_webhook.")] = "",
    action_type: Annotated[
        int | None, Field(description="Audit log event type filter (Discord audit log event code).")
    ] = None,
    guild_name: Annotated[str, Field(description="Server name label for RAG ingest.")] = "",
    channel_name: Annotated[str, Field(description="Channel name label for RAG ingest.")] = "",
    table_name: Annotated[str, Field(description="LanceDB table name for RAG operations.")] = "discord_messages",
    query_text: Annotated[str, Field(description="Semantic search query text for rag_query.")] = "",
    top_k: Annotated[int, Field(description="Number of top results for rag_query (1-100).", ge=1, le=100)] = 10,
) -> dict:
    """Unified Discord portmanteau tool — single entry point for all Discord REST API operations.

    [RATIONALE] Portmanteau consolidates 36 Discord operations into one tool, avoiding dozens of
    atomic tools that bloat the MCP host context. The operation parameter dispatches internally.

    Operations: list_guilds, list_channels, send_message, get_messages, edit_message, delete_message,
    list_active_threads, get_guild_stats, create_channel, delete_channel, create_guild, create_invite, list_invites,
    revoke_invite, list_members, get_member, ban_member, unban_member, kick_member, timeout_member,
    list_bans, create_dm, list_roles, create_role, delete_role, assign_role, remove_role,
    list_webhooks, create_webhook, delete_webhook, send_webhook, list_emojis, delete_emoji,
    list_stickers, get_audit_log, rag_ingest, rag_query.

    ## Return Format
    {"success": bool, ...operation-specific fields, "error": str (on failure)}

    ## Examples
    discord(operation="list_guilds")
    discord(operation="send_message", channel_id="123", content="Hello!")
    discord(operation="ban_member", guild_id="456", user_id="789", reason="Spam")
    discord(operation="create_dm", user_id="789")
    discord(operation="get_audit_log", guild_id="456", limit=20)
    """
    correlation_id = getattr(ctx, "correlation_id", "mcp") if ctx else "manual"
    logger.info("Executing discord operation: %s", operation, extra={"correlation_id": correlation_id})
    op_lower = operation.lower().strip()
    blocked = _destructive_preflight_block(op_lower)
    if blocked:
        return blocked
    if not _headers():
        return {
            "success": False,
            "error": "Discord token not set. Set DISCORD_TOKEN (or DISCORD_BOT_TOKEN fallback) with your bot token.",
        }
    try:
        if op_lower == "list_guilds":
            return await _list_guilds()
        if op_lower == "list_channels":
            if not guild_id:
                return {"success": False, "error": "list_channels requires guild_id."}
            return await _list_channels(guild_id)
        if op_lower == "send_message":
            if not channel_id or not content:
                return {"success": False, "error": "send_message requires channel_id and content."}
            allowed, err = await check_send_message(channel_id, content)
            if not allowed:
                return {"success": False, "error": err, "rate_limited": True}
            return await _send_message(channel_id, content)
        if op_lower == "get_messages":
            if not channel_id:
                return {"success": False, "error": "get_messages requires channel_id."}
            out = await _get_messages(channel_id, limit)
            if ctx and out.get("success") and out.get("messages"):
                out["messages"] = wrap_message_list(out["messages"])
            return out
        if op_lower == "export_messages":
            if not channel_id:
                return {"success": False, "error": "export_messages requires channel_id."}
            return await _export_messages_markdown(channel_id, limit)
        if op_lower == "list_active_threads":
            if not channel_id:
                return {"success": False, "error": "list_active_threads requires channel_id."}
            return await _list_active_threads(channel_id)
        if op_lower == "get_guild_stats":
            if not guild_id:
                return {"success": False, "error": "get_guild_stats requires guild_id."}
            return await _get_guild_stats(guild_id)
        if op_lower == "create_channel":
            if not guild_id or not name:
                return {"success": False, "error": "create_channel requires guild_id and name."}
            allowed, err = await check_create_channel()
            if not allowed:
                return {"success": False, "error": err, "rate_limited": True}
            return await _create_channel(guild_id, name, channel_type, parent_id)
        if op_lower == "delete_channel":
            if not channel_id:
                return {"success": False, "error": "delete_channel requires channel_id."}
            return await _delete_channel(channel_id)
        if op_lower == "create_guild":
            if not name:
                return {"success": False, "error": "create_guild requires name."}
            return await _create_guild(name)
        if op_lower == "create_invite":
            if not channel_id:
                return {"success": False, "error": "create_invite requires channel_id."}
            allowed, err = await check_create_invite()
            if not allowed:
                return {"success": False, "error": err, "rate_limited": True}
            return await _create_invite(channel_id, max_age, max_uses)
        if op_lower == "list_invites":
            if not guild_id:
                return {"success": False, "error": "list_invites requires guild_id."}
            return await _list_invites(guild_id)
        if op_lower == "revoke_invite":
            if not invite_code:
                return {"success": False, "error": "revoke_invite requires invite_code."}
            return await _revoke_invite(invite_code)
        if op_lower == "list_members":
            if not guild_id:
                return {"success": False, "error": "list_members requires guild_id."}
            return await _list_members(guild_id, limit)
        if op_lower == "get_member":
            if not guild_id or not user_id:
                return {"success": False, "error": "get_member requires guild_id and user_id."}
            return await _get_member(guild_id, user_id)
        if op_lower == "rag_ingest":
            if not channel_id:
                return {"success": False, "error": "rag_ingest requires channel_id."}
            out = await _get_messages(channel_id, limit)
            if not out.get("success"):
                return {"success": False, "ingested": 0, "error": out.get("error", "get_messages failed")}
            messages = out.get("messages") or []
            return await asyncio.to_thread(
                ingest_messages,
                messages,
                guild_name=guild_name or "",
                channel_name=channel_name or "",
                channel_id=channel_id,
                guild_id=guild_id or "",
                table_name=table_name or "discord_messages",
            )
        if op_lower == "rag_query":
            if not query_text:
                return {"success": False, "hits": [], "error": "rag_query requires query_text."}
            out = await rag_query_async(
                query_text.strip(),
                top_k=max(1, min(100, top_k)),
                table_name=table_name or "discord_messages",
            )
            if ctx and out.get("success") and out.get("hits"):
                out["hits"] = wrap_rag_hits(out["hits"])
            return out
        if op_lower == "edit_message":
            if not channel_id or not message_id or not content:
                return {"success": False, "error": "edit_message requires channel_id, message_id, and content."}
            return await _edit_message(channel_id, message_id, content)
        if op_lower == "delete_message":
            if not channel_id or not message_id:
                return {"success": False, "error": "delete_message requires channel_id and message_id."}
            return await _delete_message(channel_id, message_id, reason)
        if op_lower == "create_dm":
            if not user_id:
                return {"success": False, "error": "create_dm requires user_id (recipient)."}
            return await _create_dm(user_id)
        if op_lower == "ban_member":
            if not guild_id or not user_id:
                return {"success": False, "error": "ban_member requires guild_id and user_id."}
            return await _ban_member(guild_id, user_id, delete_message_seconds, reason)
        if op_lower == "unban_member":
            if not guild_id or not user_id:
                return {"success": False, "error": "unban_member requires guild_id and user_id."}
            return await _unban_member(guild_id, user_id, reason)
        if op_lower == "kick_member":
            if not guild_id or not user_id:
                return {"success": False, "error": "kick_member requires guild_id and user_id."}
            return await _kick_member(guild_id, user_id, reason)
        if op_lower == "timeout_member":
            if not guild_id or not user_id:
                return {"success": False, "error": "timeout_member requires guild_id and user_id."}
            return await _timeout_member(guild_id, user_id, communication_disabled_until, reason)
        if op_lower == "list_bans":
            if not guild_id:
                return {"success": False, "error": "list_bans requires guild_id."}
            return await _list_bans(guild_id, limit)
        if op_lower == "list_roles":
            if not guild_id:
                return {"success": False, "error": "list_roles requires guild_id."}
            return await _list_roles(guild_id)
        if op_lower == "create_role":
            if not guild_id or not name:
                return {"success": False, "error": "create_role requires guild_id and name."}
            return await _create_role(guild_id, name, permissions, color, hoist, mentionable)
        if op_lower == "delete_role":
            if not guild_id or not role_id:
                return {"success": False, "error": "delete_role requires guild_id and role_id."}
            return await _delete_role(guild_id, role_id)
        if op_lower == "assign_role":
            if not guild_id or not user_id or not role_id:
                return {"success": False, "error": "assign_role requires guild_id, user_id, and role_id."}
            return await _assign_role(guild_id, user_id, role_id)
        if op_lower == "remove_role":
            if not guild_id or not user_id or not role_id:
                return {"success": False, "error": "remove_role requires guild_id, user_id, and role_id."}
            return await _remove_role(guild_id, user_id, role_id)
        if op_lower == "list_webhooks":
            if not channel_id:
                return {"success": False, "error": "list_webhooks requires channel_id."}
            return await _list_webhooks(channel_id)
        if op_lower == "create_webhook":
            if not channel_id or not webhook_name:
                return {"success": False, "error": "create_webhook requires channel_id and webhook_name."}
            return await _create_webhook(channel_id, webhook_name)
        if op_lower == "delete_webhook":
            if not webhook_id:
                return {"success": False, "error": "delete_webhook requires webhook_id."}
            return await _delete_webhook(webhook_id)
        if op_lower == "send_webhook":
            if not webhook_id or not webhook_token or not content:
                return {"success": False, "error": "send_webhook requires webhook_id, webhook_token, and content."}
            return await _send_webhook(webhook_id, webhook_token, content)
        if op_lower == "list_emojis":
            if not guild_id:
                return {"success": False, "error": "list_emojis requires guild_id."}
            return await _list_emojis(guild_id)
        if op_lower == "delete_emoji":
            if not guild_id or not role_id:
                return {"success": False, "error": "delete_emoji requires guild_id and role_id (emoji_id)."}
            return await _delete_emoji(guild_id, role_id, reason)
        if op_lower == "list_stickers":
            if not guild_id:
                return {"success": False, "error": "list_stickers requires guild_id."}
            return await _list_stickers(guild_id)
        if op_lower == "get_audit_log":
            if not guild_id:
                return {"success": False, "error": "get_audit_log requires guild_id."}
            return await _get_audit_log(guild_id, limit, user_id, action_type)
        return {
            "success": False,
            "error": (
                f"Unknown operation: {operation}. Available: list_guilds, list_channels, send_message, "
                "get_messages, edit_message, delete_message, export_messages, list_active_threads, get_guild_stats, "
                "create_channel, delete_channel, create_guild, create_invite, list_invites, revoke_invite, list_members, "
                "get_member, ban_member, unban_member, kick_member, timeout_member, list_bans, create_dm, "
                "list_roles, create_role, delete_role, assign_role, remove_role, list_webhooks, create_webhook, "
                "delete_webhook, send_webhook, list_emojis, delete_emoji, list_stickers, get_audit_log, "
                "rag_ingest, rag_query."
            ),
        }
    except Exception as e:
        logger.exception("Discord operation failed")
        return {"success": False, "error": str(e), "correlation_id": correlation_id}


async def _list_guilds() -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "GET", f"{DISCORD_API}/users/@me/guilds", headers=_headers())
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        guilds = [{"id": g["id"], "name": g.get("name", ""), "owner": g.get("owner", False)} for g in data]
        return {"success": True, "guilds": guilds, "count": len(guilds)}


async def _list_channels(guild_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "GET", f"{DISCORD_API}/guilds/{guild_id}/channels", headers=_headers())
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        channels = [{"id": c["id"], "name": c.get("name", ""), "type": c.get("type", 0)} for c in data]
        return {"success": True, "channels": channels, "count": len(channels)}


async def _send_message(channel_id: str, content: str) -> dict:
    max_len = min(get_rate_limit_config()["max_message_length"], 2000)
    body = content[:max_len]
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "POST",
            f"{DISCORD_API}/channels/{channel_id}/messages",
            headers=_headers(),
            json={"content": body},
        )
        if r.status_code not in (200, 201):
            return _discord_api_error(r)
        record_send_message(channel_id)
        msg = r.json()
        return {"success": True, "message_id": msg.get("id"), "channel_id": channel_id}


def _serialize_message(m: dict) -> dict:
    author = m.get("author") or {}
    author_name = sanitize_text(author.get("username", ""))
    content = sanitize_text((m.get("content") or "")[:2000])
    ref = m.get("referenced_message")
    ref_msg = None
    if ref and isinstance(ref, dict):
        ref_author = ref.get("author") or {}
        ref_msg = {
            "id": ref.get("id"),
            "author": sanitize_text(ref_author.get("username", "")),
            "content": sanitize_text((ref.get("content") or "")[:500]),
        }
    attachments = []
    for a in m.get("attachments") or []:
        attachments.append({"url": a.get("url"), "filename": sanitize_text(a.get("filename"))})
    embeds = []
    for e in m.get("embeds") or []:
        embeds.append(
            {
                "title": sanitize_text((e.get("title") or "")[:200]),
                "url": e.get("url"),
                "description": sanitize_text((e.get("description") or "")[:500]),
            }
        )
    return {
        "id": m.get("id"),
        "author": author_name,
        "content": content,
        "timestamp": m.get("timestamp"),
        "edited_timestamp": m.get("edited_timestamp"),
        "attachments": attachments[:10],
        "embeds": embeds[:5],
        "referenced_message": ref_msg,
    }


async def _get_messages(channel_id: str, limit: int) -> dict:
    limit = max(1, min(100, limit))
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "GET",
            f"{DISCORD_API}/channels/{channel_id}/messages?limit={limit}",
            headers=_headers(),
        )
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        messages = [_serialize_message(m) for m in data]
        return {"success": True, "messages": messages, "count": len(messages)}


async def _export_messages_markdown(channel_id: str, limit: int = 50) -> dict:
    """Fetch messages and return as formatted markdown suitable for Notion/Obsidian."""
    out = await _get_messages(channel_id, limit)
    if not out.get("success"):
        return out
    messages = out.get("messages", [])
    if not messages:
        return {"success": True, "markdown": "*No messages in this channel.*", "count": 0}
    lines = []
    for m in reversed(messages):
        ts = (m.get("timestamp") or "")[:19].replace("T", " ") if m.get("timestamp") else ""
        author = m.get("author", "Unknown")
        content = m.get("content", "")
        ref = m.get("referenced_message")
        parts = []
        if ref and ref.get("content"):
            parts.append(f"> *Reply to {ref['author']}: {ref['content'][:200]}*\n")
        parts.append(content[:1500])
        if m.get("attachments"):
            for a in m["attachments"][:3]:
                parts.append(f"📎 [{a.get('filename', 'file')}]({a.get('url')})")
        if m.get("embeds"):
            for e in m["embeds"][:2]:
                title = e.get("title")
                url = e.get("url")
                if title and url:
                    parts.append(f"🔗 [{title}]({url})")
        body = "\n".join(parts)
        lines.append(f"### {author} — {ts}\n{body}\n")
    return {"success": True, "markdown": "\n".join(lines), "count": len(messages)}


async def _list_active_threads(channel_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "GET",
            f"{DISCORD_API}/channels/{channel_id}/threads/active",
            headers=_headers(),
        )
        if r.status_code == 404:
            return {"success": True, "threads": [], "count": 0}
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        threads = data.get("threads", []) if isinstance(data, dict) else []
        out = [
            {
                "id": t.get("id"),
                "name": t.get("name", ""),
                "type": t.get("type"),
                "parent_id": t.get("parent_id"),
                "message_count": t.get("message_count"),
                "member_count": t.get("member_count"),
            }
            for t in threads
        ]
        return {"success": True, "threads": out, "count": len(out)}


async def _get_guild_stats(guild_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "GET",
            f"{DISCORD_API}/guilds/{guild_id}?with_counts=true",
            headers=_headers(),
        )
        if r.status_code != 200:
            return _discord_api_error(r)
        g = r.json()
        return {
            "success": True,
            "guild_id": g.get("id"),
            "name": g.get("name"),
            "member_count": g.get("approximate_member_count"),
            "online_count": g.get("approximate_presence_count"),
            "owner_id": g.get("owner_id"),
            "icon": g.get("icon"),
            "description": (g.get("description") or "")[:200],
        }


async def _create_channel(guild_id: str, name: str, channel_type: int = 0, parent_id: str | None = None) -> dict:
    payload: dict = {"name": name[:100], "type": channel_type}
    if parent_id:
        payload["parent_id"] = parent_id
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "POST",
            f"{DISCORD_API}/guilds/{guild_id}/channels",
            headers=_headers(),
            json=payload,
        )
        if r.status_code not in (200, 201):
            return _discord_api_error(r)
        record_create_channel()
        c = r.json()
        return {
            "success": True,
            "channel_id": c.get("id"),
            "name": c.get("name"),
            "type": c.get("type"),
            "guild_id": guild_id,
        }


async def _delete_channel(channel_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "DELETE",
            f"{DISCORD_API}/channels/{channel_id}",
            headers=_headers(),
        )
        if r.status_code not in (200, 204):
            return _discord_api_error(r)
        return {"success": True, "channel_id": channel_id, "deleted": True}


async def _create_guild(name: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "POST",
            f"{DISCORD_API}/guilds",
            headers=_headers(),
            json={"name": name[:100]},
        )
        if r.status_code in (200, 201):
            g = r.json()
            return {"success": True, "guild_id": g.get("id"), "name": g.get("name")}
        err = r.text[:500]
        if r.status_code == 403:
            return {
                "success": False,
                "error": (
                    f"Discord API 403: {err}. Creating servers (guilds) requires "
                    "user OAuth2, not bot token. User must create the server in "
                    "the Discord client, then invite the bot."
                ),
            }
        return _discord_api_error(r)


async def _create_invite(channel_id: str, max_age: int = 86400, max_uses: int = 0) -> dict:
    max_age = max(0, min(604800, max_age))
    max_uses = max(0, min(100, max_uses))
    payload: dict = {"max_age": max_age, "max_uses": max_uses}
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "POST",
            f"{DISCORD_API}/channels/{channel_id}/invites",
            headers=_headers(),
            json=payload,
        )
        if r.status_code not in (200, 201):
            return _discord_api_error(r)
        record_create_invite()
        inv = r.json()
        return {
            "success": True,
            "code": inv.get("code"),
            "url": inv.get("url"),
            "channel_id": channel_id,
            "max_age": max_age,
            "max_uses": max_uses,
        }


async def _list_invites(guild_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "GET", f"{DISCORD_API}/guilds/{guild_id}/invites", headers=_headers())
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        invites = [
            {
                "code": i.get("code"),
                "url": i.get("url"),
                "uses": i.get("uses"),
                "max_uses": i.get("max_uses"),
                "inviter": i.get("inviter", {}).get("username") if i.get("inviter") else None,
            }
            for i in data
        ]
        return {"success": True, "invites": invites, "count": len(invites)}


async def _revoke_invite(invite_code: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "DELETE", f"{DISCORD_API}/invites/{invite_code}", headers=_headers())
        if r.status_code not in (200, 204):
            return _discord_api_error(r)
        return {"success": True, "code": invite_code, "revoked": True}


async def _list_members(guild_id: str, limit: int = 100) -> dict:
    limit = max(1, min(1000, limit))
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "GET",
            f"{DISCORD_API}/guilds/{guild_id}/members?limit={limit}",
            headers=_headers(),
        )
        if r.status_code != 200:
            err = r.text[:500]
            if r.status_code == 403:
                return {
                    "success": False,
                    "error": f"Discord API 403: {err}. Enable GUILD_MEMBERS privileged intent in Developer Portal.",
                }
            return _discord_api_error(r)
        data = r.json()
        members = [
            {
                "user_id": m.get("user", {}).get("id"),
                "username": m.get("user", {}).get("username"),
                "nick": m.get("nick"),
                "roles": m.get("roles", []),
                "joined_at": m.get("joined_at"),
            }
            for m in data
        ]
        return {"success": True, "members": members, "count": len(members)}


async def _get_member(guild_id: str, user_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "GET",
            f"{DISCORD_API}/guilds/{guild_id}/members/{user_id}",
            headers=_headers(),
        )
        if r.status_code != 200:
            err = r.text[:500]
            if r.status_code == 403:
                return {
                    "success": False,
                    "error": f"Discord API 403: {err}. Enable GUILD_MEMBERS privileged intent in Developer Portal.",
                }
            return _discord_api_error(r)
        m = r.json()
        u = m.get("user", {})
        return {
            "success": True,
            "user_id": u.get("id"),
            "username": u.get("username"),
            "nick": m.get("nick"),
            "roles": m.get("roles", []),
            "joined_at": m.get("joined_at"),
        }


async def _edit_message(channel_id: str, message_id: str, content: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "PATCH",
            f"{DISCORD_API}/channels/{channel_id}/messages/{message_id}",
            headers=_headers(),
            json={"content": content[:2000]},
        )
        if r.status_code != 200:
            return _discord_api_error(r)
        msg = r.json()
        return {"success": True, "message_id": msg.get("id"), "channel_id": channel_id, "edited": True}


async def _delete_message(channel_id: str, message_id: str, reason: str = "") -> dict:
    hdrs = _headers()
    if reason:
        hdrs["X-Audit-Log-Reason"] = reason[:512]
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client, "DELETE", f"{DISCORD_API}/channels/{channel_id}/messages/{message_id}", headers=hdrs
        )
        if r.status_code == 404:
            return {"success": False, "error": "Message not found (already deleted or wrong ID)."}
        if r.status_code != 204:
            return _discord_api_error(r)
        return {"success": True, "message_id": message_id, "channel_id": channel_id, "deleted": True}


async def _create_dm(recipient_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client, "POST", f"{DISCORD_API}/users/@me/channels", headers=_headers(), json={"recipient_id": recipient_id}
        )
        if r.status_code not in (200, 201):
            return _discord_api_error(r)
        ch = r.json()
        return {"success": True, "channel_id": ch.get("id"), "dm": True, "recipient_id": recipient_id}


async def _ban_member(guild_id: str, user_id: str, delete_message_seconds: int = 0, reason: str = "") -> dict:
    hdrs = _headers()
    if reason:
        hdrs["X-Audit-Log-Reason"] = reason[:512]
    payload: dict = {}
    if delete_message_seconds > 0:
        payload["delete_message_seconds"] = min(delete_message_seconds, 604800)
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client, "PUT", f"{DISCORD_API}/guilds/{guild_id}/bans/{user_id}", headers=hdrs, json=payload
        )
        if r.status_code == 404:
            return {"success": False, "error": "User or guild not found."}
        if r.status_code == 403:
            return {"success": False, "error": f"Missing BAN_MEMBERS permission. {r.text[:200]}"}
        if r.status_code not in (200, 201, 204):
            return _discord_api_error(r)
        return {"success": True, "guild_id": guild_id, "user_id": user_id, "banned": True}


async def _unban_member(guild_id: str, user_id: str, reason: str = "") -> dict:
    hdrs = _headers()
    if reason:
        hdrs["X-Audit-Log-Reason"] = reason[:512]
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "DELETE", f"{DISCORD_API}/guilds/{guild_id}/bans/{user_id}", headers=hdrs)
        if r.status_code == 404:
            return {"success": False, "error": "User not banned or not found."}
        if r.status_code not in (200, 204):
            return _discord_api_error(r)
        return {"success": True, "guild_id": guild_id, "user_id": user_id, "unbanned": True}


async def _kick_member(guild_id: str, user_id: str, reason: str = "") -> dict:
    hdrs = _headers()
    if reason:
        hdrs["X-Audit-Log-Reason"] = reason[:512]
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "DELETE", f"{DISCORD_API}/guilds/{guild_id}/members/{user_id}", headers=hdrs)
        if r.status_code == 404:
            return {"success": False, "error": "User not in guild or not found."}
        if r.status_code == 403:
            return {"success": False, "error": f"Missing KICK_MEMBERS permission. {r.text[:200]}"}
        if r.status_code != 204:
            return _discord_api_error(r)
        return {"success": True, "guild_id": guild_id, "user_id": user_id, "kicked": True}


async def _timeout_member(
    guild_id: str, user_id: str, communication_disabled_until: str | None, reason: str = ""
) -> dict:
    if not communication_disabled_until:
        return {"success": False, "error": "timeout_member requires communication_disabled_until (ISO 8601 timestamp)."}
    hdrs = _headers()
    if reason:
        hdrs["X-Audit-Log-Reason"] = reason[:512]
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "PATCH",
            f"{DISCORD_API}/guilds/{guild_id}/members/{user_id}",
            headers=hdrs,
            json={"communication_disabled_until": communication_disabled_until},
        )
        if r.status_code == 403:
            return {"success": False, "error": f"Missing MODERATE_MEMBERS permission. {r.text[:200]}"}
        if r.status_code != 200:
            return _discord_api_error(r)
        return {
            "success": True,
            "guild_id": guild_id,
            "user_id": user_id,
            "timed_out_until": communication_disabled_until,
        }


async def _list_bans(guild_id: str, limit: int = 100) -> dict:
    limit = max(1, min(1000, limit))
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client, "GET", f"{DISCORD_API}/guilds/{guild_id}/bans?limit={limit}", headers=_headers()
        )
        if r.status_code == 403:
            return {"success": False, "error": "Missing BAN_MEMBERS permission."}
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        bans = [
            {
                "user_id": b.get("user", {}).get("id"),
                "username": b.get("user", {}).get("username"),
                "reason": (b.get("reason") or "")[:500],
            }
            for b in data
        ]
        return {"success": True, "bans": bans, "count": len(bans)}


async def _list_roles(guild_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "GET", f"{DISCORD_API}/guilds/{guild_id}/roles", headers=_headers())
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        roles = [
            {
                "id": rl.get("id"),
                "name": rl.get("name"),
                "color": rl.get("color"),
                "hoist": rl.get("hoist"),
                "position": rl.get("position"),
                "permissions": rl.get("permissions"),
                "managed": rl.get("managed"),
                "mentionable": rl.get("mentionable"),
            }
            for rl in data
        ]
        return {"success": True, "roles": roles, "count": len(roles)}


async def _create_role(
    guild_id: str, name: str, permissions: str = "0", color: int = 0, hoist: bool = False, mentionable: bool = False
) -> dict:
    payload: dict = {"name": name[:100]}
    try:
        payload["permissions"] = str(int(permissions))
    except (ValueError, TypeError):
        payload["permissions"] = "0"
    if color:
        payload["color"] = min(max(color, 0), 16777215)
    payload["hoist"] = hoist
    payload["mentionable"] = mentionable
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client, "POST", f"{DISCORD_API}/guilds/{guild_id}/roles", headers=_headers(), json=payload
        )
        if r.status_code not in (200, 201):
            return _discord_api_error(r)
        role = r.json()
        return {
            "success": True,
            "role_id": role.get("id"),
            "name": role.get("name"),
            "color": role.get("color"),
            "guild_id": guild_id,
        }


async def _delete_role(guild_id: str, role_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client, "DELETE", f"{DISCORD_API}/guilds/{guild_id}/roles/{role_id}", headers=_headers()
        )
        if r.status_code == 404:
            return {"success": False, "error": "Role not found."}
        if r.status_code == 403:
            return {"success": False, "error": "Missing MANAGE_ROLES permission."}
        if r.status_code != 204:
            return _discord_api_error(r)
        return {"success": True, "guild_id": guild_id, "role_id": role_id, "deleted": True}


async def _assign_role(guild_id: str, user_id: str, role_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client, "PUT", f"{DISCORD_API}/guilds/{guild_id}/members/{user_id}/roles/{role_id}", headers=_headers()
        )
        if r.status_code == 403:
            return {"success": False, "error": "Missing MANAGE_ROLES permission."}
        if r.status_code != 204:
            return _discord_api_error(r)
        return {"success": True, "guild_id": guild_id, "user_id": user_id, "role_id": role_id, "assigned": True}


async def _remove_role(guild_id: str, user_id: str, role_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "DELETE",
            f"{DISCORD_API}/guilds/{guild_id}/members/{user_id}/roles/{role_id}",
            headers=_headers(),
        )
        if r.status_code == 403:
            return {"success": False, "error": "Missing MANAGE_ROLES permission."}
        if r.status_code != 204:
            return _discord_api_error(r)
        return {"success": True, "guild_id": guild_id, "user_id": user_id, "role_id": role_id, "removed": True}


async def _list_webhooks(channel_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "GET", f"{DISCORD_API}/channels/{channel_id}/webhooks", headers=_headers())
        if r.status_code == 403:
            return {"success": False, "error": "Missing MANAGE_WEBHOOKS permission."}
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        webhooks = [
            {
                "id": w.get("id"),
                "name": w.get("name"),
                "channel_id": w.get("channel_id"),
                "guild_id": w.get("guild_id"),
                "token": w.get("token"),
            }
            for w in data
        ]
        return {"success": True, "webhooks": webhooks, "count": len(webhooks)}


async def _create_webhook(channel_id: str, webhook_name: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client,
            "POST",
            f"{DISCORD_API}/channels/{channel_id}/webhooks",
            headers=_headers(),
            json={"name": webhook_name[:80]},
        )
        if r.status_code not in (200, 201):
            return _discord_api_error(r)
        wh = r.json()
        return {
            "success": True,
            "webhook_id": wh.get("id"),
            "name": wh.get("name"),
            "token": wh.get("token"),
            "channel_id": channel_id,
            "url": f"https://discord.com/api/webhooks/{wh.get('id')}/{wh.get('token')}",
        }


async def _delete_webhook(webhook_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "DELETE", f"{DISCORD_API}/webhooks/{webhook_id}", headers=_headers())
        if r.status_code == 404:
            return {"success": False, "error": "Webhook not found."}
        if r.status_code not in (200, 204):
            return _discord_api_error(r)
        return {"success": True, "webhook_id": webhook_id, "deleted": True}


async def _send_webhook(webhook_id: str, webhook_token: str, content: str) -> dict:
    """Execute a webhook — uses webhook token auth, not bot token."""
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await client.post(
            f"{DISCORD_API}/webhooks/{webhook_id}/{webhook_token}?wait=true",
            headers={"Content-Type": "application/json"},
            json={"content": content[:2000]},
        )
        if r.status_code in (200, 201):
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            return {"success": True, "message_id": data.get("id"), "webhook_id": webhook_id}
        if r.status_code == 404:
            return {"success": False, "error": "Webhook not found. Check webhook_id and webhook_token."}
        return _discord_api_error(r)


async def _list_emojis(guild_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "GET", f"{DISCORD_API}/guilds/{guild_id}/emojis", headers=_headers())
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        emojis = [
            {
                "id": e.get("id"),
                "name": e.get("name"),
                "animated": e.get("animated", False),
                "available": e.get("available", True),
                "roles": e.get("roles", []),
            }
            for e in data
        ]
        return {"success": True, "emojis": emojis, "count": len(emojis)}


async def _delete_emoji(guild_id: str, emoji_id: str, reason: str = "") -> dict:
    hdrs = _headers()
    if reason:
        hdrs["X-Audit-Log-Reason"] = reason[:512]
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "DELETE", f"{DISCORD_API}/guilds/{guild_id}/emojis/{emoji_id}", headers=hdrs)
        if r.status_code == 404:
            return {"success": False, "error": "Emoji not found."}
        if r.status_code == 403:
            return {"success": False, "error": "Missing MANAGE_EMOJIS_AND_STICKERS permission."}
        if r.status_code != 204:
            return _discord_api_error(r)
        return {"success": True, "guild_id": guild_id, "emoji_id": emoji_id, "deleted": True}


async def _list_stickers(guild_id: str) -> dict:
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(client, "GET", f"{DISCORD_API}/guilds/{guild_id}/stickers", headers=_headers())
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        stickers = [
            {
                "id": s.get("id"),
                "name": s.get("name"),
                "tags": s.get("tags"),
                "description": (s.get("description") or "")[:200],
                "available": s.get("available", True),
            }
            for s in data
        ]
        return {"success": True, "stickers": stickers, "count": len(stickers)}


async def _get_audit_log(
    guild_id: str, limit: int = 50, user_id: str | None = None, action_type: int | None = None
) -> dict:
    limit = max(1, min(100, limit))
    params = f"limit={limit}"
    if user_id:
        params += f"&user_id={user_id}"
    if action_type is not None:
        params += f"&action_type={action_type}"
    async with httpx.AsyncClient(timeout=_DISCORD_HTTP_TIMEOUT) as client:
        r = await _discord_request(
            client, "GET", f"{DISCORD_API}/guilds/{guild_id}/audit-logs?{params}", headers=_headers()
        )
        if r.status_code == 403:
            return {"success": False, "error": "Missing VIEW_AUDIT_LOG permission."}
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        entries = data.get("audit_log_entries", [])
        out = []
        for entry in entries:
            out.append(
                {
                    "id": entry.get("id"),
                    "action_type": entry.get("action_type"),
                    "user_id": entry.get("user_id"),
                    "target_id": entry.get("target_id"),
                    "reason": (entry.get("reason") or "")[:500],
                    "created_at": entry.get("created_at"),
                }
            )
        return {"success": True, "entries": out, "count": len(out)}
