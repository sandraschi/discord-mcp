#!/usr/bin/env python3
"""Discord MCP Server — FastMCP 3.1, sampling, skills, agentic workflow (SEP-1577)."""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path


def _load_dotenv_file() -> None:
    """Load repo-root `.env` into the process (does not override existing os.environ)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    # server.py: src/discord_mcp/server.py -> repo root
    root = Path(__file__).resolve().parent.parent.parent
    env_path = root / ".env"
    if env_path.is_file():
        load_dotenv(env_path, override=False)


_load_dotenv_file()

import uvicorn
from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fastmcp import FastMCP
from fastmcp.server.providers.skills import SkillsDirectoryProvider

from .agentic import discord_agentic_workflow
from .portmanteau import discord_tool
from .rate_limit import get_rate_limit_config
from .sampling import DiscordSamplingHandler
from .state import _state

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("discord-mcp")

_USE_CLIENT_SAMPLING = os.getenv("DISCORD_SAMPLING_USE_CLIENT_LLM", "").lower() in (
    "1",
    "true",
    "yes",
)

SKILLS_ROOT = Path(__file__).resolve().parent / "skills"
sampling_handler = DiscordSamplingHandler()

_MCP_INSTRUCTIONS = """You are Discord MCP (FastMCP 3.1): a fleet-standard bridge to Discord via the bot REST API.

CORE: Portmanteau tool `discord(operation=...)` for guilds, channels, messages, invites, members, threads, stats, and optional LanceDB RAG (rag_ingest, rag_query).
AGENTIC: `discord_agentic_workflow(goal, ctx)` plans multi-step tasks using sampling with tools (SEP-1577). Requires DISCORD_TOKEN; sampling uses local Ollama by default (DISCORD_SAMPLING_*) or client LLM when configured.
SAFETY: Server-side rate limits on send_message, channel creation, and invites. Respect Discord ToS and server rules.
SKILLS: Bundled workflows under resource URIs skill://*/SKILL.md — see list_resources.
PROMPTS: Use registered prompts for setup, moderation, RAG, and invite workflows.

When unsure, call discord_help() or discord(operation='list_guilds') first."""


# --- Help ---
_HELP_CATEGORIES = {
    "list_guilds": "List bot guilds. discord(operation='list_guilds').",
    "list_channels": "List channels in a guild. discord(operation='list_channels', guild_id='...').",
    "send_message": "Send a message. discord(operation='send_message', channel_id='...', content='...').",
    "get_messages": "Get recent messages. discord(operation='get_messages', channel_id='...', limit=50).",
    "list_active_threads": "List active threads in a channel. discord(operation='list_active_threads', channel_id='...').",
    "get_guild_stats": "Guild stats (member_count, online_count). discord(operation='get_guild_stats', guild_id='...').",
    "create_channel": "Create channel. discord(operation='create_channel', guild_id='...', name='...', channel_type=0, parent_id=?). type: 0=text, 2=voice, 4=category.",
    "create_guild": "Create server (user OAuth2 only; bot token returns 403). discord(operation='create_guild', name='...').",
    "create_invite": "Create invite link. discord(operation='create_invite', channel_id='...', max_age=86400, max_uses=0). Rate limited.",
    "list_invites": "List guild invites. discord(operation='list_invites', guild_id='...').",
    "revoke_invite": "Revoke invite. discord(operation='revoke_invite', invite_code='...').",
    "list_members": "List guild members (GUILD_MEMBERS intent). discord(operation='list_members', guild_id='...', limit=100).",
    "get_member": "Get one member (GUILD_MEMBERS intent). discord(operation='get_member', guild_id='...', user_id='...').",
    "connection": "Set DISCORD_TOKEN (bot token from Discord Developer Portal).",
    "safety": "Rate limits: messages/min, per-channel/min, channels/min, invites/min, min interval, max message length. Env: DISCORD_RATE_LIMIT_*, DISCORD_MAX_MESSAGE_LENGTH, DISCORD_MIN_MESSAGE_INTERVAL_SECONDS.",
    "rag_ingest": "Ingest channel messages into LanceDB for RAG. discord(operation='rag_ingest', channel_id='...', limit=50, guild_name='?', channel_name='?', table_name='discord_messages').",
    "rag_query": "Semantic search over ingested Discord. discord(operation='rag_query', query_text='...', top_k=10, table_name='discord_messages').",
}


async def discord_help(category: str | None = None, topic: str | None = None) -> dict:
    """Multi-level help for Discord MCP."""
    _ = topic
    if not category:
        return {"help": "Discord MCP", "categories": _HELP_CATEGORIES}
    if category not in _HELP_CATEGORIES:
        return {"error": f"Unknown category: {category}", "available": list(_HELP_CATEGORIES.keys())}
    return {"category": category, "detail": _HELP_CATEGORIES[category]}


mcp = FastMCP(
    name="discord-mcp",
    instructions=_MCP_INSTRUCTIONS,
    sampling_handler=sampling_handler,
    sampling_handler_behavior="fallback" if _USE_CLIENT_SAMPLING else "always",
    strict_input_validation=True,
    on_duplicate="replace",
    tasks=False,
)

if SKILLS_ROOT.exists():
    mcp.add_provider(SkillsDirectoryProvider(roots=SKILLS_ROOT, reload=False))

mcp.tool()(discord_tool)
mcp.tool()(discord_help)
mcp.tool()(discord_agentic_workflow)


@mcp.prompt
def discord_quick_start() -> str:
    """Setup and connect instructions for Discord MCP."""
    return """You are helping set up the Discord MCP server.

1. Create a bot at https://discord.com/developers/applications. Copy the bot token.
2. Set DISCORD_TOKEN in environment or .env. Invite the bot to your server (OAuth2 URL Generator, scope: bot).
3. Start server: uv run python -m discord_mcp.server --mode dual --port 10756.
4. MCP HTTP endpoint: http://localhost:10756/mcp (streamable HTTP). Dashboard: http://localhost:10757.
5. Use discord(operation='list_guilds') or discord_agentic_workflow(goal='...'). For local agentic sampling, run Ollama or set DISCORD_SAMPLING_USE_CLIENT_LLM=1."""


@mcp.prompt
def discord_diagnostics() -> str:
    """Diagnostic checklist for Discord MCP."""
    return """Run a quick diagnostic:

1. Ensure DISCORD_TOKEN is set (bot token from Discord Developer Portal).
2. Call discord(operation='list_guilds') to verify bot can see guilds.
3. Call discord(operation='list_channels', guild_id='<guild_id>') for a guild.
4. Check GET /api/v1/health and /api/v1/meta on the backend. Open dashboard http://localhost:10757."""


@mcp.prompt
def discord_moderation_playbook() -> str:
    """Safe messaging and moderation patterns."""
    return """You operate Discord MCP with anti-spam rate limits enabled.

- Prefer read-only discovery (list_guilds, list_channels, get_messages) before sending.
- For send_message: keep content concise; respect DISCORD_MAX_MESSAGE_LENGTH.
- Never exfiltrate tokens or private user data. Do not mass-DM or spam invites.
- If GUILD_MEMBERS intent is missing, explain that list_members/get_member will fail."""


@mcp.prompt
def discord_rag_workflow() -> str:
    """RAG ingest and query workflow."""
    return """Use LanceDB-backed semantic search over Discord history:

1. Pick a text channel ID (from list_channels).
2. discord(operation='rag_ingest', channel_id='...', limit=50, guild_name='?', channel_name='?', table_name='discord_messages').
3. discord(operation='rag_query', query_text='...', top_k=10, table_name='discord_messages').
4. Cite message IDs and channels when summarizing results."""


@mcp.prompt
def discord_invite_operations() -> str:
    """Invites: create, list, revoke."""
    return """Invite operations:

- create_invite: channel_id required; max_age seconds; max_uses 0 = unlimited (subject to rate limits).
- list_invites: guild_id lists all guild invites.
- revoke_invite: invite_code (not full URL).

Warn users that public invite links are sensitive."""


@mcp.resource("resource://discord-mcp/capabilities")
def discord_capabilities_resource() -> str:
    """Machine-readable capability summary for clients."""
    return (
        "Discord MCP capabilities (FastMCP 3.1). Tools: discord (portmanteau REST), discord_help, "
        "discord_agentic_workflow (sampling). Sampling: local OpenAI-compatible via DISCORD_SAMPLING_* "
        "or client LLM when DISCORD_SAMPLING_USE_CLIENT_LLM=1. RAG: LanceDB rag_ingest/rag_query. "
        "Skills: skill://<skill>/SKILL.md from bundled skills/. HTTP MCP mount: /mcp"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Discord MCP REST + MCP mount starting")
    _state["token_set"] = bool(os.environ.get("DISCORD_TOKEN", "").strip())
    yield
    logger.info("Discord MCP shutting down")


app = FastAPI(title="Discord MCP", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/v1/health")
async def health():
    return {
        "status": "ok",
        "service": "discord-mcp",
        "token_set": bool(os.environ.get("DISCORD_TOKEN", "").strip()),
        "rate_limit": get_rate_limit_config(),
        "sampling": sampling_handler.status(),
        "sampling_use_client_llm_preferred": _USE_CLIENT_SAMPLING,
        "mcp_http_path": "/mcp",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/v1/meta")
async def meta():
    return {
        "service": "discord-mcp",
        "fastmcp": "3.1",
        "mcp_transport": "streamable-http",
        "mcp_path": "/mcp",
        "tools": ["discord", "discord_help", "discord_agentic_workflow"],
        "prompts": [
            "discord_quick_start",
            "discord_diagnostics",
            "discord_moderation_playbook",
            "discord_rag_workflow",
            "discord_invite_operations",
        ],
        "resources": ["resource://discord-mcp/capabilities"],
        "skills_root": str(SKILLS_ROOT),
        "sampling": sampling_handler.status(),
    }


@app.get("/api/v1/skills")
async def list_skills():
    if not SKILLS_ROOT.is_dir():
        return {"skills": []}
    out: list[dict[str, str]] = []
    for d in sorted(SKILLS_ROOT.iterdir()):
        if not d.is_dir():
            continue
        sk = d / "SKILL.md"
        if not sk.is_file():
            continue
        try:
            text = sk.read_text(encoding="utf-8")
        except OSError:
            continue
        preview = text[:800] + ("…" if len(text) > 800 else "")
        out.append({"name": d.name, "preview": preview})
    return {"skills": out}


@app.get("/api/v1/guilds")
async def api_guilds():
    out = await discord_tool(ctx=None, operation="list_guilds")
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Guilds unavailable"))
    return out


@app.get("/api/v1/guilds/{guild_id}/channels")
async def api_channels(guild_id: str):
    out = await discord_tool(ctx=None, operation="list_channels", guild_id=guild_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Channels unavailable"))
    return out


@app.get("/api/v1/guilds/{guild_id}/stats")
async def api_guild_stats(guild_id: str):
    out = await discord_tool(ctx=None, operation="get_guild_stats", guild_id=guild_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Stats unavailable"))
    return out


@app.get("/api/v1/guilds/{guild_id}/invites")
async def api_invites(guild_id: str):
    out = await discord_tool(ctx=None, operation="list_invites", guild_id=guild_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Invites unavailable"))
    return out


@app.get("/api/v1/guilds/{guild_id}/members")
async def api_members(guild_id: str, limit: int = 100):
    out = await discord_tool(ctx=None, operation="list_members", guild_id=guild_id, limit=limit)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Members unavailable"))
    return out


class SendMessageBody(BaseModel):
    content: str


class RagIngestBody(BaseModel):
    channel_id: str
    limit: int = 50
    guild_name: str = ""
    channel_name: str = ""
    table_name: str = "discord_messages"
    guild_id: str = ""


class RagQueryBody(BaseModel):
    query_text: str
    top_k: int = 10
    table_name: str = "discord_messages"


@app.get("/api/v1/channels/{channel_id}/messages")
async def api_channel_messages(channel_id: str, limit: int = 50):
    out = await discord_tool(
        ctx=None, operation="get_messages", channel_id=channel_id, limit=limit
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Messages unavailable"))
    return out


@app.get("/api/v1/channels/{channel_id}/threads")
async def api_channel_threads(channel_id: str):
    out = await discord_tool(
        ctx=None, operation="list_active_threads", channel_id=channel_id
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Threads unavailable"))
    return out


@app.post("/api/v1/channels/{channel_id}/messages")
async def api_send_message(channel_id: str, body: SendMessageBody = Body(...)):
    out = await discord_tool(
        ctx=None, operation="send_message", channel_id=channel_id, content=body.content
    )
    if not out.get("success"):
        status = 429 if out.get("rate_limited") else 502
        raise HTTPException(status_code=status, detail=out.get("error", "Send failed"))
    return out


@app.post("/api/v1/rag/ingest")
async def api_rag_ingest(body: RagIngestBody = Body(...)):
    out = await discord_tool(
        ctx=None,
        operation="rag_ingest",
        channel_id=body.channel_id,
        limit=body.limit,
        guild_name=body.guild_name,
        channel_name=body.channel_name,
        table_name=body.table_name,
        guild_id=body.guild_id,
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "RAG ingest failed"))
    return out


@app.post("/api/v1/rag/query")
async def api_rag_query(body: RagQueryBody = Body(...)):
    out = await discord_tool(
        ctx=None,
        operation="rag_query",
        query_text=body.query_text,
        top_k=body.top_k,
        table_name=body.table_name,
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "RAG query failed"))
    return out


app.mount("/mcp", mcp.http_app(transport="streamable-http", path="/"))


def main() -> None:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--mode", default="dual", choices=("stdio", "http", "dual"))
    p.add_argument("--port", type=int, default=10756)
    args = p.parse_args()
    if args.mode == "stdio":
        asyncio.run(mcp.run_stdio_async())
        return
    uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
