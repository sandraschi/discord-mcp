"""Portmanteau tool discord(operation=...) for Discord (FastMCP 3.1). Uses Discord REST API."""
import asyncio
import logging
import os
from fastmcp import Context
import httpx

from .rag import ingest_messages, rag_query_async
from .rate_limit import (
    check_send_message,
    record_send_message,
    check_create_channel,
    record_create_channel,
    check_create_invite,
    record_create_invite,
    get_rate_limit_config,
)

logger = logging.getLogger("discord-mcp.portmanteau")

DISCORD_API = "https://discord.com/api/v10"
_DISCORD_HTTP_TIMEOUT = 120.0
_DISCORD_429_RETRIES = 5


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
        pass
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
            pass
    return out


def _headers() -> dict:
    token = os.environ.get("DISCORD_TOKEN", "").strip()
    if not token:
        return {}
    return {"Authorization": f"Bot {token}", "Content-Type": "application/json"}


async def discord_tool(
    ctx: Context | None = None,
    operation: str = "list_guilds",
    guild_id: str | None = None,
    channel_id: str | None = None,
    content: str | None = None,
    limit: int = 50,
    name: str | None = None,
    channel_type: int = 0,
    parent_id: str | None = None,
    invite_code: str | None = None,
    max_age: int = 86400,
    max_uses: int = 0,
    user_id: str | None = None,
    guild_name: str = "",
    channel_name: str = "",
    table_name: str = "discord_messages",
    query_text: str = "",
    top_k: int = 10,
) -> dict:
    """Unified Discord tool via REST API.

    Operations: list_guilds, list_channels, send_message, get_messages, get_guild_stats,
    create_channel, create_guild, create_invite, list_invites, revoke_invite, list_members, get_member.
    create_guild requires user OAuth2 (bot returns 403). list_members/get_member require GUILD_MEMBERS intent.
    Requires DISCORD_TOKEN (bot token). Returns dict with success (bool); on failure includes error (str).
    """
    correlation_id = getattr(ctx, "correlation_id", "mcp") if ctx else "manual"
    logger.info("Executing discord operation: %s", operation, extra={"correlation_id": correlation_id})
    op_lower = operation.lower().strip()
    if not _headers():
        return {"success": False, "error": "DISCORD_TOKEN not set. Create a bot at Discord Developer Portal."}
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
            return await _get_messages(channel_id, limit)
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
            return await rag_query_async(
                query_text.strip(),
                top_k=max(1, min(100, top_k)),
                table_name=table_name or "discord_messages",
            )
        return {
            "success": False,
            "error": (
                f"Unknown operation: {operation}. Use list_guilds, list_channels, send_message, get_messages, "
                "list_active_threads, get_guild_stats, create_channel, create_guild, create_invite, list_invites, "
                "rag_ingest, rag_query, "
                "revoke_invite, list_members, get_member."
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
        r = await _discord_request(
            client, "GET", f"{DISCORD_API}/guilds/{guild_id}/channels", headers=_headers()
        )
        if r.status_code != 200:
            return _discord_api_error(r)
        data = r.json()
        channels = [
            {"id": c["id"], "name": c.get("name", ""), "type": c.get("type", 0)}
            for c in data
        ]
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
    author_name = author.get("username", "")
    content = (m.get("content") or "")[:2000]
    ref = m.get("referenced_message")
    ref_msg = None
    if ref and isinstance(ref, dict):
        ref_author = ref.get("author") or {}
        ref_msg = {
            "id": ref.get("id"),
            "author": ref_author.get("username", ""),
            "content": (ref.get("content") or "")[:500],
        }
    attachments = []
    for a in m.get("attachments") or []:
        attachments.append({"url": a.get("url"), "filename": a.get("filename")})
    embeds = []
    for e in m.get("embeds") or []:
        embeds.append({
            "title": (e.get("title") or "")[:200],
            "url": e.get("url"),
            "description": (e.get("description") or "")[:500],
        })
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


async def _create_channel(
    guild_id: str, name: str, channel_type: int = 0, parent_id: str | None = None
) -> dict:
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
                "error": f"Discord API 403: {err}. Creating servers (guilds) requires user OAuth2, not bot token. User must create the server in the Discord client, then invite the bot.",
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
        r = await _discord_request(
            client, "GET", f"{DISCORD_API}/guilds/{guild_id}/invites", headers=_headers()
        )
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
        r = await _discord_request(
            client, "DELETE", f"{DISCORD_API}/invites/{invite_code}", headers=_headers()
        )
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
