#!/usr/bin/env python3
"""Discord MCP Server — FastMCP 3.2, sampling, skills, agentic workflow (SEP-1577)."""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

_STARTED = datetime.now(UTC)
_SHUTTING_DOWN = False

def _resolve_git_sha() -> str:
    try:
        import subprocess
        repo = Path(__file__).resolve().parents[2]
        return subprocess.run(  # noqa: S603
            ["git", "-C", str(repo), "rev-parse", "--short", "HEAD"],  # noqa: S607
            capture_output=True, text=True, timeout=2,
        ).stdout.strip() or "unknown"
    except Exception:
        return "unknown"

GIT_SHA = _resolve_git_sha()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("discord-mcp")


def _load_dotenv_file() -> None:
    """Load `.env` into the process, checking multiple locations (does not override existing env)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return

    candidates = []

    # 1. Next to the executable (good for frozen executables/installations)
    if getattr(sys, "frozen", False) and hasattr(sys, "executable"):
        candidates.append(Path(sys.executable).parent / ".env")

    # 2. Current working directory
    cwd = Path.cwd()
    candidates.append(cwd / ".env")

    # 3. Parents of current working directory (e.g. repo root when run from subdirectory)
    for parent in cwd.parents:
        candidates.append(parent / ".env")

    # 4. Source tree relative to this file
    try:
        candidates.append(Path(__file__).resolve().parent.parent.parent / ".env")
    except Exception as exc:
        logger.debug("Failed to resolve __file__ parent candidate: %s", exc)

    for env_path in candidates:
        if env_path.is_file():
            load_dotenv(env_path, override=False)
            logger.info("Loaded environment from %s", env_path)
            break


_load_dotenv_file()

import uvicorn  # noqa: E402
from fastapi import Body, FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastmcp import FastMCP  # noqa: E402
from fastmcp.server import create_proxy  # noqa: E402
from fastmcp.server.providers.skills import SkillsDirectoryProvider  # noqa: E402
from pydantic import BaseModel  # noqa: E402
from pydantic import Field as PydanticField  # noqa: E402

from .activity_log import ActivityLog, create_log_router  # noqa: E402
from .agentic import _runs, discord_agentic_workflow, execute_run_loop  # noqa: E402
from .message_watcher import (  # noqa: E402
    maybe_autostart_from_env,
    message_watcher_status,
    start_message_watcher,
    stop_message_watcher,
)
from .portmanteau import _resolve_discord_token, discord_tool  # noqa: E402
from .rate_limit import get_rate_limit_config  # noqa: E402
from .tools.prefab_cards import register_prefab_tools  # noqa: E402
from .sampling import DiscordSamplingHandler  # noqa: E402
from .state import _state  # noqa: E402

_USE_CLIENT_SAMPLING = os.getenv("DISCORD_SAMPLING_USE_CLIENT_LLM", "").lower() in (
    "1",
    "true",
    "yes",
)

SKILLS_ROOT = Path(__file__).resolve().parent / "skills"
_skills_cache: dict[str, dict] | None = None
sampling_handler = DiscordSamplingHandler()

_MCP_INSTRUCTIONS = """You are Discord MCP (FastMCP 3.2): a fleet-standard bridge to Discord via the bot REST API.

CORE: Portmanteau tool `discord(operation=...)` for guilds, channels, messages, invites, members,
threads, stats, and optional LanceDB RAG (rag_ingest, rag_query).
AGENTIC: `discord_agentic_workflow(goal, ctx)` plans multi-step tasks using sampling with tools
(SEP-1577). Requires DISCORD_TOKEN; sampling uses local Ollama by default (DISCORD_SAMPLING_*) or
client LLM when configured.
SAFETY: Server-side rate limits on send_message, channel creation, and invites. Respect Discord ToS
and server rules.
SKILLS: Bundled workflows under resource URIs skill://*/SKILL.md — see list_resources.
PROMPTS: Use registered prompts for setup, moderation, RAG, and invite workflows.

When unsure, call discord_help() or discord(operation='list_guilds') first."""


# --- Help ---
_HELP_CATEGORIES = {
    "list_guilds": "List bot guilds. discord(operation='list_guilds').",
    "list_channels": "List channels in a guild. discord(operation='list_channels', guild_id='...').",
    "send_message": "Send a message. discord(operation='send_message', channel_id='...', content='...').",
    "get_messages": "Get recent messages. discord(operation='get_messages', channel_id='...', limit=50).",
    "list_active_threads": (
        "List active threads in a channel. discord(operation='list_active_threads', channel_id='...')."
    ),
    "get_guild_stats": (
        "Guild stats (member_count, online_count). discord(operation='get_guild_stats', guild_id='...')."
    ),
    "create_channel": (
        "Create channel. discord(operation='create_channel', guild_id='...', "
        "name='...', channel_type=0, parent_id=?). type: 0=text, 2=voice, 4=category."
    ),
    "create_guild": (
        "Create server (user OAuth2 only; bot token returns 403). discord(operation='create_guild', name='...')."
    ),
    "create_invite": (
        "Create invite link. discord(operation='create_invite', channel_id='...', "
        "max_age=86400, max_uses=0). Rate limited."
    ),
    "list_invites": "List guild invites. discord(operation='list_invites', guild_id='...').",
    "revoke_invite": "Revoke invite. discord(operation='revoke_invite', invite_code='...').",
    "list_members": (
        "List guild members (GUILD_MEMBERS intent). discord(operation='list_members', guild_id='...', limit=100)."
    ),
    "get_member": (
        "Get one member (GUILD_MEMBERS intent). discord(operation='get_member', guild_id='...', user_id='...')."
    ),
    "connection": "Set DISCORD_TOKEN (bot token from Discord Developer Portal).",
    "safety": (
        "Rate limits: messages/min, per-channel/min, channels/min, invites/min, "
        "min interval, max message length. Env: DISCORD_RATE_LIMIT_*, "
        "DISCORD_MAX_MESSAGE_LENGTH, DISCORD_MIN_MESSAGE_INTERVAL_SECONDS."
    ),
    "rag_ingest": (
        "Ingest channel messages into LanceDB for RAG. "
        "discord(operation='rag_ingest', channel_id='...', limit=50, "
        "guild_name='?', channel_name='?', table_name='discord_messages')."
    ),
    "rag_query": (
        "Semantic search over ingested Discord. "
        "discord(operation='rag_query', query_text='...', top_k=10, "
        "table_name='discord_messages')."
    ),
    "edit_message": (
        "Edit a bot-sent message. discord(operation='edit_message', "
        "channel_id='...', message_id='...', content='new text')."
    ),
    "delete_message": (
        "Delete a bot-sent message. discord(operation='delete_message', "
        "channel_id='...', message_id='...', reason='...')."
    ),
    "create_dm": ("Create a DM channel with a user. discord(operation='create_dm', user_id='...')."),
    "ban_member": (
        "Ban a user from a guild. discord(operation='ban_member', guild_id='...', "
        "user_id='...', delete_message_seconds=0, reason='...'). Requires BAN_MEMBERS."
    ),
    "unban_member": ("Remove a ban. discord(operation='unban_member', guild_id='...', user_id='...')."),
    "kick_member": (
        "Kick a user from a guild. discord(operation='kick_member', guild_id='...', "
        "user_id='...', reason='...'). Requires KICK_MEMBERS."
    ),
    "timeout_member": (
        "Timeout a user (disable communication). discord(operation='timeout_member', "
        "guild_id='...', user_id='...', communication_disabled_until='ISO-8601 timestamp'). "
        "Requires MODERATE_MEMBERS."
    ),
    "list_bans": (
        "List banned users. discord(operation='list_bans', guild_id='...', limit=100). Requires BAN_MEMBERS."
    ),
    "list_roles": ("List guild roles. discord(operation='list_roles', guild_id='...')."),
    "create_role": (
        "Create a role. discord(operation='create_role', guild_id='...', name='Role', "
        "permissions='0', color=0, hoist=False, mentionable=False). Requires MANAGE_ROLES."
    ),
    "delete_role": (
        "Delete a role. discord(operation='delete_role', guild_id='...', role_id='...'). Requires MANAGE_ROLES."
    ),
    "assign_role": (
        "Assign a role to a member. discord(operation='assign_role', guild_id='...', "
        "user_id='...', role_id='...'). Requires MANAGE_ROLES."
    ),
    "remove_role": (
        "Remove a role from a member. discord(operation='remove_role', guild_id='...', "
        "user_id='...', role_id='...'). Requires MANAGE_ROLES."
    ),
    "list_webhooks": (
        "List webhooks in a channel. discord(operation='list_webhooks', channel_id='...'). Requires MANAGE_WEBHOOKS."
    ),
    "create_webhook": (
        "Create a webhook. discord(operation='create_webhook', channel_id='...', "
        "webhook_name='MyHook'). Returns token — save it! Requires MANAGE_WEBHOOKS."
    ),
    "delete_webhook": (
        "Delete a webhook. discord(operation='delete_webhook', webhook_id='...'). Requires MANAGE_WEBHOOKS."
    ),
    "send_webhook": (
        "Execute a webhook (send message). discord(operation='send_webhook', "
        "webhook_id='...', webhook_token='...', content='Hello!'). Uses webhook token, not bot."
    ),
    "list_emojis": ("List custom emojis in a guild. discord(operation='list_emojis', guild_id='...')."),
    "delete_emoji": (
        "Delete a custom emoji. discord(operation='delete_emoji', guild_id='...', "
        "role_id='emoji_id', reason='...'). Requires MANAGE_EMOJIS_AND_STICKERS. "
        "Note: use role_id param for the emoji ID."
    ),
    "list_stickers": ("List custom stickers in a guild. discord(operation='list_stickers', guild_id='...')."),
    "get_audit_log": (
        "Fetch guild audit log entries. discord(operation='get_audit_log', guild_id='...', "
        "limit=50, user_id='?', action_type=?)). Requires VIEW_AUDIT_LOG."
    ),
}


async def discord_help(
    category: Annotated[
        str | None,
        PydanticField(description="Optional help category key (e.g. 'send_message', 'safety'). Omit for full index."),
    ] = None,
    topic: Annotated[str | None, PydanticField(description="Optional sub-topic within a category.")] = None,
) -> dict:
    """Multi-level help system for Discord MCP operations and configuration.

    ## Return Format
    {"help": str, "categories": dict}  (full index without category)
    {"category": str, "detail": str}   (single category lookup)
    {"error": str, "available": list}  (unknown category)

    ## Examples
    discord_help()
    discord_help(category="send_message")
    discord_help(category="safety")
    """
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

# MCP Bridge: proxy upstream servers via MCP_BRIDGE_URLS (comma-separated)
_bridge_proxies = []
bridge_urls = os.getenv("MCP_BRIDGE_URLS", "")
if bridge_urls:
    for url in bridge_urls.split(","):
        url = url.strip()
        if url:
            try:
                mcp.add_provider(create_proxy(url))
                _bridge_proxies.append(url)
            except Exception:
                logger.warning("Failed to add MCP bridge proxy: %s", url, exc_info=True)

mcp.tool()(discord_tool)
mcp.tool()(discord_help)
mcp.tool()(discord_agentic_workflow)
register_prefab_tools(mcp)


async def start_message_watcher_tool(
    mode: Annotated[str, PydanticField(description="gateway (real-time) or poll (REST).")] = "gateway",
    interval: Annotated[int, PydanticField(description="Poll interval seconds (poll mode only).", ge=10)] = 30,
    webhook_url: Annotated[
        str, PydanticField(description="Webhook URL for robofang/fleet-agent (e.g. http://127.0.0.1:10956/api/alerts).")
    ] = "",
    channels: Annotated[
        str,
        PydanticField(
            description='JSON list of channels, e.g. [{"channel_id":"123","guild_id":"456"}].',
        ),
    ] = "[]",
    auto_reply: Annotated[
        bool, PydanticField(description="Send template reply in-channel on inbound messages.")
    ] = False,
    auto_reply_template: Annotated[
        str, PydanticField(description="Reply template with {author}, {content}, {channel_id}.")
    ] = "",
    auto_rag: Annotated[
        bool, PydanticField(description="Enable auto-syncing inbound messages to LanceDB RAG.")
    ] = False,
) -> dict:
    """Start Discord Gateway/poll watcher — inbound messages → webhook + optional auto-reply.

    Comms lane: fires `new_discord_message` JSON to robofang or fleet-agent.
    Enable MESSAGE CONTENT intent in Discord Developer Portal for gateway mode.
    """
    import json as _json

    try:
        ch_list = _json.loads(channels) if isinstance(channels, str) else channels
    except _json.JSONDecodeError:
        return {"running": False, "error": "channels must be valid JSON array"}
    if not isinstance(ch_list, list):
        return {"running": False, "error": "channels must be a JSON array"}
    return start_message_watcher(
        mode=mode,
        interval=interval,
        webhook_url=webhook_url,
        channels=ch_list,
        auto_reply=auto_reply,
        auto_reply_template=auto_reply_template,
        auto_rag=auto_rag,
    )


async def stop_message_watcher_tool() -> dict:
    """Stop the Discord message watcher."""
    return stop_message_watcher()


async def message_watcher_status_tool() -> dict:
    """Check Discord message watcher status."""
    return message_watcher_status()


mcp.tool()(start_message_watcher_tool)
mcp.tool()(stop_message_watcher_tool)
mcp.tool()(message_watcher_status_tool)


@mcp.prompt
def discord_quick_start() -> str:
    """Setup and connect instructions for Discord MCP."""
    return """You are helping set up the Discord MCP server.

1. Create a bot at https://discord.com/developers/applications. Copy the bot token.
2. Set DISCORD_TOKEN in environment or .env. Invite the bot to your server
   (OAuth2 URL Generator, scope: bot).
3. Start server: uv run python -m discord_mcp.server --mode dual --port 10756.
4. MCP HTTP endpoint: http://localhost:10756/mcp (streamable HTTP).
   Dashboard: http://localhost:10757.
5. Use discord(operation='list_guilds') or discord_agentic_workflow(goal='...').
   For local agentic sampling, run Ollama or set DISCORD_SAMPLING_USE_CLIENT_LLM=1."""


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
2. discord(operation='rag_ingest', channel_id='...', limit=50,
   guild_name='?', channel_name='?', table_name='discord_messages').
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
        "Discord MCP capabilities (FastMCP 3.2). Tools: discord (portmanteau REST), discord_help, "
        "discord_agentic_workflow (sampling). Sampling: local OpenAI-compatible via DISCORD_SAMPLING_* "
        "or client LLM when DISCORD_SAMPLING_USE_CLIENT_LLM=1. RAG: LanceDB rag_ingest/rag_query. "
        "Skills: skill://<skill>/SKILL.md from bundled skills/. HTTP MCP mount: /mcp"
    )


_discord_mcp_http = mcp.http_app(transport="streamable-http", path="/")

# FastMCP 3.4.4 requires the http_app lifespan in the parent FastAPI
# for StreamableHTTPSessionManager to initialize.
# Move discord-specific startup/shutdown to event handlers.
app = FastAPI(title="Discord MCP", lifespan=_discord_mcp_http.lifespan)


@app.on_event("startup")
async def _discord_startup():
    _state.token_set = bool(_resolve_discord_token())
    await maybe_autostart_from_env()
    logger.info("Discord MCP REST + MCP mount starting")


@app.on_event("shutdown")
async def _discord_shutdown():
    global _SHUTTING_DOWN
    _SHUTTING_DOWN = True
    stop_message_watcher()
    logger.info("Discord MCP shutting down")
app.add_middleware(
    CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:10756",
            "http://localhost:10756",
            "http://goliath:10756",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
    ],
    allow_origin_regex=r"https?://(?:[a-zA-Z0-9-]+\.ts\.net|.*?\.tail-[a-f0-9]+\.ts\.net|tauri\.localhost|localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|100\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?$|^tauri://localhost$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request, call_next):
    import time
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000.0  # in ms
    if request.url.path.startswith("/api/v1"):
        try:
            from .analytics import tracker
            tracker.record_call(process_time)
            if response.status_code >= 400:
                tracker.record_error()
            if response.status_code == 429:
                tracker.record_rate_limit()
        except Exception as exc:
            logger.debug("Telemetry logging failed: %s", exc)
    return response


class SaveSettingsBody(BaseModel):
    settings: dict[str, str]


def _get_dotenv_path() -> Path:
    candidates = []
    if getattr(sys, "frozen", False) and hasattr(sys, "executable"):
        candidates.append(Path(sys.executable).parent / ".env")
    cwd = Path.cwd()
    candidates.append(cwd / ".env")
    for parent in cwd.parents:
        candidates.append(parent / ".env")
    try:
        candidates.append(Path(__file__).resolve().parent.parent.parent / ".env")
    except Exception as exc:
        logger.debug("Failed to resolve __file__ parent candidate: %s", exc)
    for path in candidates:
        if path.is_file():
            return path
    return Path.cwd() / ".env"


def _update_dotenv(settings: dict[str, str]) -> bool:
    path = _get_dotenv_path()
    lines = []
    if path.is_file():
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except OSError:
            pass

    updated_keys = set()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in line:
            parts = stripped.split("=", 1)
            key = parts[0].strip()
            if key in settings:
                new_lines.append(f"{key}={settings[key]}")
                updated_keys.add(key)
                continue
        new_lines.append(line)

    for key, val in settings.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={val}")

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        for key, val in settings.items():
            os.environ[key] = val
        return True
    except OSError:
        return False


mcp_log = ActivityLog()
app.include_router(create_log_router(mcp_log), prefix="/api")


class AutomationRuleBody(BaseModel):
    id: str
    name: str
    trigger: str = "on_message"
    condition_type: str = "contains"
    condition_value: str = ""
    action_type: str = "reply"
    action_value: str = ""
    active: bool = True


class SaveAutomationRulesBody(BaseModel):
    rules: list[AutomationRuleBody]


@app.post("/api/v1/settings")
async def api_save_settings(body: SaveSettingsBody):
    success = _update_dotenv(body.settings)
    # Re-evaluate token status
    _state.token_set = bool(_resolve_discord_token())
    return {"success": success}


@app.get("/api/v1/rules")
async def api_get_rules():
    from .rules import _load_rules
    return _load_rules()


@app.post("/api/v1/rules")
async def api_save_rules(body: SaveAutomationRulesBody):
    from .rules import _save_rules
    rules_dict = [r.dict() for r in body.rules]
    success = _save_rules(rules_dict)
    return {"success": success}


@app.get("/api/v1/stats/analytics")
async def api_get_analytics():
    from .analytics import tracker
    return tracker.get_stats()


class SlackMappingBody(BaseModel):
    id: str
    discord_channel_id: str
    slack_webhook_url: str
    active: bool = True


class SaveSlackBridgeBody(BaseModel):
    mappings: list[SlackMappingBody]


@app.get("/api/v1/slack-bridge")
async def api_get_slack_bridge():
    from .slack_bridge import _load_mappings
    return _load_mappings()


@app.post("/api/v1/slack-bridge")
async def api_save_slack_bridge(body: SaveSlackBridgeBody):
    from .slack_bridge import _save_mappings
    maps = [m.dict() for m in body.mappings]
    success = _save_mappings(maps)
    return {"success": success}


@app.get("/api/v1/intents")
async def api_intents():
    import httpx
    token = _resolve_discord_token()
    if not token:
        return {
            "token_valid": False,
            "error": "No bot token configured.",
            "client_id": None,
            "username": None,
            "intents": {
                "guild_members": False,
                "message_content": False
            }
        }

    headers = {"Authorization": f"Bot {token}"}
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.get("https://discord.com/api/v10/users/@me", headers=headers)
            if r.status_code != 200:
                return {
                    "token_valid": False,
                    "error": f"Invalid bot token (Discord API returned {r.status_code}).",
                    "client_id": None,
                    "username": None,
                    "intents": {
                        "guild_members": False,
                        "message_content": False
                    }
                }
            user_data = r.json()
            username = user_data.get("username")
            client_id = user_data.get("id")

            g_res = await client.get("https://discord.com/api/v10/users/@me/guilds", headers=headers)
            guilds = g_res.json() if g_res.status_code == 200 else []

            members_intent = False
            message_content_intent = False
            if guilds and isinstance(guilds, list):
                first_guild_id = guilds[0].get("id")
                m_res = await client.get(
                    f"https://discord.com/api/v10/guilds/{first_guild_id}/members?limit=1",
                    headers=headers
                )
                if m_res.status_code == 200:
                    members_intent = True

            watcher = message_watcher_status()
            if watcher.get("running") and watcher.get("config", {}).get("mode") == "gateway":
                message_content_intent = True

            return {
                "token_valid": True,
                "username": username,
                "client_id": client_id,
                "guilds_count": len(guilds) if isinstance(guilds, list) else 0,
                "invite_url": f"https://discord.com/oauth2/authorize?client_id={client_id}&permissions=8&scope=bot",
                "intents": {
                    "guild_members": members_intent,
                    "message_content": message_content_intent
                }
            }
        except Exception as e:
            return {
                "token_valid": False,
                "error": f"Connection error: {e!s}",
                "client_id": None,
                "username": None,
                "intents": {
                    "guild_members": False,
                    "message_content": False
                }
            }


@app.get("/health")
@app.get("/api/health")
async def root_health():
    from . import __version__
    uptime = int((datetime.now(UTC) - _STARTED).total_seconds())
    return {
        "status": "ok",
        "server": "discord-mcp",
        "version": __version__,
        "git_sha": GIT_SHA,
        "started_at": _STARTED.isoformat(),
        "uptime_seconds": uptime,
        "shutting_down": _SHUTTING_DOWN,
        "transport": "streamable-http",
        "port": 10756
    }


@app.get("/api/v1/health")
async def health():
    from . import __version__
    uptime = int((datetime.now(UTC) - _STARTED).total_seconds())
    return {
        "status": "ok",
        "server": "discord-mcp",
        "version": __version__,
        "git_sha": GIT_SHA,
        "started_at": _STARTED.isoformat(),
        "uptime_seconds": uptime,
        "shutting_down": _SHUTTING_DOWN,
        "transport": "streamable-http",
        "port": 10756,
        "service": "discord-mcp",
        "token_set": bool(_resolve_discord_token()),
        "rate_limit": get_rate_limit_config(),
        "sampling": sampling_handler.status(),
        "sampling_use_client_llm_preferred": _USE_CLIENT_SAMPLING,
        "mcp_http_path": "/mcp",
        "comms_watcher": message_watcher_status(),
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/v1/meta")
async def meta():
    return {
        "service": "discord-mcp",
        "fastmcp": "3.2",
        "mcp_transport": "streamable-http",
        "mcp_path": "/mcp",
        "tools": [
            "discord",
            "discord_help",
            "discord_agentic_workflow",
            "start_message_watcher_tool",
            "stop_message_watcher_tool",
            "message_watcher_status_tool",
        ],
        "operations": [
            "list_guilds",
            "list_channels",
            "send_message",
            "get_messages",
            "edit_message",
            "delete_message",
            "list_active_threads",
            "get_guild_stats",
            "create_channel",
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
    global _skills_cache
    if _skills_cache is not None:
        return _skills_cache
    if not SKILLS_ROOT.is_dir():
        _skills_cache = {"skills": []}
        return _skills_cache
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
    _skills_cache = {"skills": out}
    return _skills_cache


@app.get("/api/v1/skills/{skill_name}")
async def get_skill(skill_name: str):
    skill_path = SKILLS_ROOT / skill_name / "SKILL.md"
    if not skill_path.is_file():
        raise HTTPException(status_code=404, detail=f"Skill '{skill_name}' not found")
    try:
        text = skill_path.read_text(encoding="utf-8")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to read skill: {e}")
    return {"name": skill_name, "content": text}


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


@app.post("/api/v1/guilds/{guild_id}/channels")
async def api_create_channel(guild_id: str, body: dict = Body(...)):
    name = body.get("name", "").strip()
    channel_type = body.get("type", 0)
    parent_id = body.get("parent_id")
    if not name:
        raise HTTPException(status_code=422, detail="name is required")
    out = await discord_tool(ctx=None, operation="create_channel", guild_id=guild_id, name=name, channel_type=channel_type, parent_id=parent_id)
    if not out.get("success"):
        status = 429 if out.get("rate_limited") else 502
        raise HTTPException(status_code=status, detail=out.get("error", "Create failed"))
    return out


@app.delete("/api/v1/channels/{channel_id}")
async def api_delete_channel(channel_id: str):
    out = await discord_tool(ctx=None, operation="delete_channel", channel_id=channel_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Delete failed"))
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


@app.post("/api/v1/channels/{channel_id}/invites")
async def api_create_invite(channel_id: str, body: dict = Body(...)):
    max_age = body.get("max_age", 86400)
    max_uses = body.get("max_uses", 0)
    out = await discord_tool(ctx=None, operation="create_invite", channel_id=channel_id, max_age=max_age, max_uses=max_uses)
    if not out.get("success"):
        status = 429 if out.get("rate_limited") else 502
        raise HTTPException(status_code=status, detail=out.get("error", "Create invite failed"))
    return out


@app.delete("/api/v1/invites/{invite_code}")
async def api_revoke_invite(invite_code: str):
    out = await discord_tool(ctx=None, operation="revoke_invite", invite_code=invite_code)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Revoke invite failed"))
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


class AgenticBody(BaseModel):
    goal: str


class EditMessageBody(BaseModel):
    content: str


class BanBody(BaseModel):
    delete_message_seconds: int = 0
    reason: str = ""


class TimeoutBody(BaseModel):
    communication_disabled_until: str
    reason: str = ""


class RoleBody(BaseModel):
    name: str
    permissions: str = "0"
    color: int = 0
    hoist: bool = False
    mentionable: bool = False


class WebhookBody(BaseModel):
    webhook_name: str


class SendWebhookBody(BaseModel):
    content: str


class CommsWatcherStartBody(BaseModel):
    mode: str = "gateway"
    interval: int = 30
    webhook_url: str = ""
    channels: list[dict] = []
    auto_reply: bool = False
    auto_reply_template: str = ""
    auto_rag: bool = False


class ApproveBody(BaseModel):
    run_id: str
    approved: bool


_background_tasks = set()


@app.post("/api/v1/agentic")
async def api_agentic(body: AgenticBody = Body(...)):
    """Natural-language agentic runner. Spawns loop and returns run ID."""
    import uuid
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    sys_prompt = (
        _MCP_INSTRUCTIONS
        + "\n\nYou are working step-by-step to fulfill the goal. Call appropriate tools."
    )
    _runs[run_id] = {
        "id": run_id,
        "goal": body.goal,
        "status": "running",
        "steps": [],
        "current_step": 0,
        "pending_tool_call": None,
        "error": None,
        "message": None,
        "system_prompt": sys_prompt
    }
    task = asyncio.create_task(execute_run_loop(run_id))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return {"success": True, "run_id": run_id}


@app.get("/api/v1/agentic/runs/{run_id}")
async def api_get_run(run_id: str):
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return _runs[run_id]


@app.post("/api/v1/agentic/approve")
async def api_approve_run(body: ApproveBody):
    if body.run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = _runs[body.run_id]
    if run["status"] != "blocked":
        raise HTTPException(status_code=400, detail="Run is not blocked waiting for approval")

    if body.approved:
        run["status"] = "running"
        run["pending_tool_call"] = None
    else:
        run["status"] = "failed"
        run["error"] = "Destructive tool call rejected by user."
        if run["steps"]:
            run["steps"][-1]["status"] = "rejected"
    return {"success": True}


@app.get("/api/v1/providers")
async def api_providers():
    """Discover available LLM providers for sampling."""
    import httpx

    status = sampling_handler.status()
    ollama_available = False
    try:
        async with httpx.AsyncClient(timeout=2.0) as c:
            r = await c.get("http://127.0.0.1:11434/api/tags")
            if r.status_code == 200:
                ollama_available = True
    except Exception:
        logger.debug("Ollama not reachable at 127.0.0.1:11434")

    return {
        "sampling": status,
        "ollama_running": ollama_available,
        "providers": [
            {
                "name": "Ollama (Local)",
                "type": "ollama",
                "available": ollama_available,
                "default_url": "http://127.0.0.1:11434/v1",
                "env_base_url": "DISCORD_SAMPLING_BASE_URL",
                "env_model": "DISCORD_SAMPLING_MODEL",
                "env_api_key": "DISCORD_SAMPLING_API_KEY",
            },
            {
                "name": "Client LLM",
                "type": "client",
                "available": bool(os.getenv("DISCORD_SAMPLING_USE_CLIENT_LLM")),
                "env_flag": "DISCORD_SAMPLING_USE_CLIENT_LLM",
            },
        ],
    }


@app.get("/api/v1/channels/{channel_id}/messages")
async def api_channel_messages(channel_id: str, limit: int = 50):
    out = await discord_tool(ctx=None, operation="get_messages", channel_id=channel_id, limit=limit)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Messages unavailable"))
    return out


@app.get("/api/v1/channels/{channel_id}/export")
async def api_export_messages(channel_id: str, limit: int = 50):
    out = await discord_tool(ctx=None, operation="export_messages", channel_id=channel_id, limit=limit)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Export failed"))
    return out


@app.get("/api/v1/channels/{channel_id}/threads")
async def api_channel_threads(channel_id: str):
    out = await discord_tool(ctx=None, operation="list_active_threads", channel_id=channel_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Threads unavailable"))
    return out


@app.post("/api/v1/channels/{channel_id}/messages")
async def api_send_message(channel_id: str, body: SendMessageBody = Body(...)):
    if not body.content.strip():
        raise HTTPException(status_code=422, detail="content cannot be empty")
    out = await discord_tool(ctx=None, operation="send_message", channel_id=channel_id, content=body.content)
    if not out.get("success"):
        status = 429 if out.get("rate_limited") else 502
        raise HTTPException(status_code=status, detail=out.get("error", "Send failed"))
    return out


# --- Message edit/delete ---


@app.patch("/api/v1/channels/{channel_id}/messages/{message_id}")
async def api_edit_message(channel_id: str, message_id: str, body: EditMessageBody = Body(...)):
    out = await discord_tool(
        ctx=None, operation="edit_message", channel_id=channel_id, message_id=message_id, content=body.content
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Edit failed"))
    return out


@app.delete("/api/v1/channels/{channel_id}/messages/{message_id}")
async def api_delete_message(channel_id: str, message_id: str):
    out = await discord_tool(ctx=None, operation="delete_message", channel_id=channel_id, message_id=message_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Delete failed"))
    return out


# --- DM ---


@app.post("/api/v1/dm")
async def api_create_dm(user_id: str = Body(..., embed=True)):
    out = await discord_tool(ctx=None, operation="create_dm", user_id=user_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "DM creation failed"))
    return out


# --- Moderation ---


@app.put("/api/v1/guilds/{guild_id}/bans/{user_id}")
async def api_ban_member(guild_id: str, user_id: str, body: BanBody = Body(...)):
    out = await discord_tool(
        ctx=None,
        operation="ban_member",
        guild_id=guild_id,
        user_id=user_id,
        delete_message_seconds=body.delete_message_seconds,
        reason=body.reason,
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Ban failed"))
    return out


@app.delete("/api/v1/guilds/{guild_id}/bans/{user_id}")
async def api_unban_member(guild_id: str, user_id: str):
    out = await discord_tool(ctx=None, operation="unban_member", guild_id=guild_id, user_id=user_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Unban failed"))
    return out


@app.delete("/api/v1/guilds/{guild_id}/members/{user_id}/kick")
async def api_kick_member(guild_id: str, user_id: str, reason: str = ""):
    out = await discord_tool(ctx=None, operation="kick_member", guild_id=guild_id, user_id=user_id, reason=reason)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Kick failed"))
    return out


@app.patch("/api/v1/guilds/{guild_id}/members/{user_id}/timeout")
async def api_timeout_member(guild_id: str, user_id: str, body: TimeoutBody = Body(...)):
    out = await discord_tool(
        ctx=None,
        operation="timeout_member",
        guild_id=guild_id,
        user_id=user_id,
        communication_disabled_until=body.communication_disabled_until,
        reason=body.reason,
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Timeout failed"))
    return out


@app.get("/api/v1/guilds/{guild_id}/bans")
async def api_list_bans(guild_id: str, limit: int = 100):
    out = await discord_tool(ctx=None, operation="list_bans", guild_id=guild_id, limit=limit)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Bans unavailable"))
    return out


# --- Roles ---


@app.get("/api/v1/guilds/{guild_id}/roles")
async def api_list_roles(guild_id: str):
    out = await discord_tool(ctx=None, operation="list_roles", guild_id=guild_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Roles unavailable"))
    return out


@app.post("/api/v1/guilds/{guild_id}/roles")
async def api_create_role(guild_id: str, body: RoleBody = Body(...)):
    out = await discord_tool(
        ctx=None,
        operation="create_role",
        guild_id=guild_id,
        name=body.name,
        permissions=body.permissions,
        color=body.color,
        hoist=body.hoist,
        mentionable=body.mentionable,
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Role creation failed"))
    return out


@app.delete("/api/v1/guilds/{guild_id}/roles/{role_id}")
async def api_delete_role(guild_id: str, role_id: str):
    out = await discord_tool(ctx=None, operation="delete_role", guild_id=guild_id, role_id=role_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Role deletion failed"))
    return out


@app.put("/api/v1/guilds/{guild_id}/members/{user_id}/roles/{role_id}")
async def api_assign_role(guild_id: str, user_id: str, role_id: str):
    out = await discord_tool(ctx=None, operation="assign_role", guild_id=guild_id, user_id=user_id, role_id=role_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Role assignment failed"))
    return out


@app.delete("/api/v1/guilds/{guild_id}/members/{user_id}/roles/{role_id}")
async def api_remove_role(guild_id: str, user_id: str, role_id: str):
    out = await discord_tool(ctx=None, operation="remove_role", guild_id=guild_id, user_id=user_id, role_id=role_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Role removal failed"))
    return out


# --- Webhooks ---


@app.get("/api/v1/channels/{channel_id}/webhooks")
async def api_list_webhooks(channel_id: str):
    out = await discord_tool(ctx=None, operation="list_webhooks", channel_id=channel_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Webhooks unavailable"))
    return out


@app.post("/api/v1/channels/{channel_id}/webhooks")
async def api_create_webhook(channel_id: str, body: WebhookBody = Body(...)):
    out = await discord_tool(
        ctx=None, operation="create_webhook", channel_id=channel_id, webhook_name=body.webhook_name
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Webhook creation failed"))
    return out


@app.delete("/api/v1/webhooks/{webhook_id}")
async def api_delete_webhook(webhook_id: str):
    out = await discord_tool(ctx=None, operation="delete_webhook", webhook_id=webhook_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Webhook deletion failed"))
    return out


@app.post("/api/v1/webhooks/{webhook_id}/{webhook_token}")
async def api_send_webhook(webhook_id: str, webhook_token: str, body: SendWebhookBody = Body(...)):
    out = await discord_tool(
        ctx=None,
        operation="send_webhook",
        webhook_id=webhook_id,
        webhook_token=webhook_token,
        content=body.content,
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Webhook send failed"))
    return out


# --- Emoji & Stickers ---


@app.get("/api/v1/guilds/{guild_id}/emojis")
async def api_list_emojis(guild_id: str):
    out = await discord_tool(ctx=None, operation="list_emojis", guild_id=guild_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Emojis unavailable"))
    return out


@app.delete("/api/v1/guilds/{guild_id}/emojis/{emoji_id}")
async def api_delete_emoji(guild_id: str, emoji_id: str, reason: str = ""):
    out = await discord_tool(ctx=None, operation="delete_emoji", guild_id=guild_id, role_id=emoji_id, reason=reason)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Emoji deletion failed"))
    return out


@app.get("/api/v1/guilds/{guild_id}/stickers")
async def api_list_stickers(guild_id: str):
    out = await discord_tool(ctx=None, operation="list_stickers", guild_id=guild_id)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Stickers unavailable"))
    return out


# --- Audit Log ---


@app.get("/api/v1/guilds/{guild_id}/audit-logs")
async def api_audit_log(guild_id: str, limit: int = 50, user_id: str | None = None, action_type: int | None = None):
    out = await discord_tool(
        ctx=None,
        operation="get_audit_log",
        guild_id=guild_id,
        limit=limit,
        user_id=user_id,
        action_type=action_type,
    )
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Audit log unavailable"))
    return out


# --- RAG ---


class RagSyncBody(BaseModel):
    channel_id: str
    limit: int = 100
    guild_id: str = ""
    guild_name: str = ""
    channel_name: str = ""


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


@app.post("/api/v1/rag/sync")
async def api_rag_sync(body: RagSyncBody = Body(...)):
    out = await discord_tool(ctx=None, operation="get_messages", channel_id=body.channel_id, limit=body.limit)
    if not out.get("success"):
        raise HTTPException(status_code=502, detail=out.get("error", "Failed to fetch messages"))

    from .rag import ingest_messages
    msgs = out.get("messages") or []
    loop = asyncio.get_event_loop()
    ingest_res = await loop.run_in_executor(
        None,
        ingest_messages,
        msgs,
        body.guild_name,
        body.channel_name,
        body.channel_id,
        body.guild_id,
    )
    if not ingest_res.get("success"):
        raise HTTPException(status_code=500, detail=ingest_res.get("error", "Ingestion failed"))
    return ingest_res


@app.get("/api/v1/rag/stats")
async def api_rag_stats():
    try:
        from .rag import _get_db
        db = _get_db()
        tables = db.table_names()
        stats = []
        for t in tables:
            tbl = db.open_table(t)
            try:
                count = tbl.count_rows()
            except Exception:
                count = 0
            stats.append({"table_name": t, "count": count})
        return {"success": True, "tables": stats}
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- Comms watcher (inbound → webhook / auto-reply) ---


@app.post("/api/v1/comms/watcher/start")
async def api_comms_watcher_start(body: CommsWatcherStartBody = Body(...)):
    out = start_message_watcher(
        mode=body.mode,
        interval=body.interval,
        webhook_url=body.webhook_url,
        channels=body.channels,
        auto_reply=body.auto_reply,
        auto_reply_template=body.auto_reply_template,
        auto_rag=body.auto_rag,
    )
    if not out.get("running") and out.get("error"):
        raise HTTPException(status_code=400, detail=out["error"])
    return out


@app.post("/api/v1/comms/watcher/stop")
async def api_comms_watcher_stop():
    return stop_message_watcher()


@app.get("/api/v1/comms/watcher/status")
async def api_comms_watcher_status():
    return message_watcher_status()


app.mount("/mcp", _discord_mcp_http)


def main() -> None:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--mode", default="dual", choices=("stdio", "http", "dual"))
    p.add_argument("--port", type=int, default=10756)
    args = p.parse_args()
    if args.mode == "stdio":
        asyncio.run(mcp.run_stdio_async())
        return
    uvicorn.run(app, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
