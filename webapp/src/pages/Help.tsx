import { HelpCircle } from "lucide-react";
import { useState } from "react";

const TABS = [
  "About Discord",
  "What You Can Do",
  "MCP Tools",
  "RAG",
  "Env & Setup",
  "FAQ",
] as const;
type Tab = (typeof TABS)[number];

const S = {
  h2: (t: string) => `<h3 class="text-base font-bold text-white mt-5 mb-2">${t}</h3>`,
  p: (t: string) => `<p class="text-slate-300 leading-relaxed">${t}</p>`,
  ul: (items: string[]) =>
    `<ul class="space-y-1 list-disc list-inside text-slate-300">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`,
  code: (t: string) => `<code class="text-indigo-300 bg-[#1a1a1e] px-1.5 py-0.5 rounded text-xs">${t}</code>`,
};

const TAB_CONTENT: Record<Tab, { title: string; html: string }> = {
  "About Discord": {
    title: "About Discord",
    html: `
${S.h2("What is Discord?")}
${S.p("Discord is a chat platform built around servers (called guilds in the API). Each guild contains channels (text, voice, announcement, categories), and users send messages, upload files, and interact within channels. Discord also supports roles, permissions, invites, webhooks, threads, emojis, stickers, and audit logging.")}
${S.h2("Guilds vs Channels")}
${S.p("A guild (server) is a container. Inside a guild you have channels — text channels for conversation, voice channels for audio, announcement channels for broadcasts, and category channels that group others. Each channel has a unique snowflake ID (a 64-bit timestamp-based identifier).")}
${S.h2("Bot Accounts vs User Accounts")}
${S.p("Your DISCORD_TOKEN is a bot token, not a user token. Bot accounts join servers via OAuth2 invite URLs, not by email login. Bot tokens start with the application ID encoded in base64. Unlike user tokens, bot tokens require explicitly enabling privileged intents (GUILD_MEMBERS, MESSAGE_CONTENT) in the Developer Portal.")}
${S.h2("Permissions & Intents")}
${S.p("Intents are declared at the application level in the Discord Developer Portal and define what gateway events your bot receives. Permissions are per-guild and define what actions the bot can perform (send messages, ban members, manage channels, etc). The server admin configures permissions when inviting the bot via the OAuth2 URL. This server uses Administrator permission (bit 8) which grants all permissions.")}
${S.h2("Rate Limits")}
${S.p("Discord enforces per-route rate limits (HTTP 429). This server automatically retries up to 5 times with exponential backoff reading Discord's retry_after header. Additionally, the server applies its own anti-spam limits per-channel and globally — you can tune these via DISCORD_RATE_LIMIT_* env vars.")}
${S.h2("API Base URL")}
${S.p("All Discord REST API calls go to https://discord.com/api/v10. The MCP server proxies these calls, handling auth (Bot prefix), rate limits, and error formatting so MCP clients interact with a clean portmanteau interface.")}
`,
  },
  "What You Can Do": {
    title: "What You Can Do",
    html: `
${S.h2("Messaging")}
${S.p("Send messages to any channel the bot can see. Edit or delete bot-sent messages. List recent messages with pagination. Create DMs with individual users and message them directly. Rate-limited per-channel (default 3/min) and globally (10/min) to prevent spam.")}
${S.h2("Moderation")}
${S.p("Ban, unban, kick, and timeout members. List bans with reasons. View audit log entries filtered by action type or user. Requires the bot to have Ban Members, Kick Members, and Moderate Members permissions, plus the GUILD_MEMBERS intent for member lookup.")}
${S.h2("Channel Management")}
${S.p("List channels in a guild with their type and ID. Create new text, voice, or announcement channels. Delete channels. The Channels page in the dashboard has a Create button that opens a form — pick a name and type and it calls the Discord API immediately.")}
${S.h2("Roles & Permissions")}
${S.p("List all roles in a guild with their color and position. Create new roles, delete existing ones, assign roles to members, and remove roles. Useful for automated onboarding, temporary access, or moderation workflows.")}
${S.h2("Invites")}
${S.p("Create invite links with configurable max age and max uses. List all active invites for a guild. Revoke invites that should no longer work.")}
${S.h2("Webhooks")}
${S.p("Create webhooks in channels, list existing webhooks, execute webhooks with custom names and avatars, and delete webhooks. Webhooks let external services post messages to Discord without a bot.")}
${S.h2("Audit & Stats")}
${S.p("View the audit log for moderation events. Get guild stats (member count, online count). Get channel stats. View guild bans with reasons.")}
${S.h2("RAG Search")}
${S.p("Ingest message history from any channel into a local LanceDB vector database. Then semantically search that history — find messages about a topic even if the exact words don't match. The ingested data persists across restarts.")}
${S.h2("Agentic Workflows")}
${S.p("Describe a goal in natural language and the server plans and executes multi-step tasks using its tool surface and LLM sampling (Ollama or your MCP host's LLM). Example: 'Audit the moderation actions from the last 24 hours and summarize them' — the server calls get_audit_log, processes the results, and presents a summary.")}
`,
  },
  "MCP Tools": {
    title: "MCP Tools",
    html: `
${S.p("discord-mcp exposes one main tool, one agentic tool, and one help tool via the FastMCP interface. All 36+ operations are consolidated under the portmanteau pattern.")}

${S.h2("discord(operation, ...)")}
${S.p("Unified entry point for all Discord API operations. The operation parameter selects which action to perform. Parameters are shared across operations (guild_id, channel_id, user_id, content, etc) — only those relevant to the chosen operation are required.")}

${S.p("<strong>Guild operations:</strong>")}
${S.ul([
  `${S.code("list_guilds")} — List all guilds the bot has joined`,
  `${S.code("get_guild_stats(guild_id)")} — Member count, online count, owner`,
  `${S.code("create_guild(name)")} — Create a new guild (user OAuth2 only)`,
])}

${S.p("<strong>Channel operations:</strong>")}
${S.ul([
  `${S.code("list_channels(guild_id)")} — All channels in a guild with type`,
  `${S.code("create_channel(guild_id, name, type, parent_id)")} — Create text (0), voice (2), or announcement (5) channel`,
  `${S.code("delete_channel(channel_id)")} — Permanently delete a channel`,
  `${S.code("list_active_threads(channel_id)")} — Active threads in a channel`,
  `${S.code("get_channel_stats(channel_id)")} — Per-channel statistics`,
])}

${S.p("<strong>Message operations:</strong>")}
${S.ul([
  `${S.code("send_message(channel_id, content)")} — Post a message (anti-spam rate limited)`,
  `${S.code("get_messages(channel_id, limit)")} — Recent messages (max 100)`,
  `${S.code("edit_message(channel_id, message_id, content)")} — Edit a bot-sent message`,
  `${S.code("delete_message(channel_id, message_id)")} — Delete a bot-sent message`,
  `${S.code("create_dm(user_id)")} — Open a DM channel, then send_message on the returned channel_id`,
])}

${S.p("<strong>Moderation operations:</strong>")}
${S.ul([
  `${S.code("ban_member(guild_id, user_id, reason, delete_message_seconds)")} — Ban with optional message purge`,
  `${S.code("unban_member(guild_id, user_id)")} — Remove a ban`,
  `${S.code("kick_member(guild_id, user_id, reason)")} — Kick a member`,
  `${S.code("timeout_member(guild_id, user_id, duration_minutes, reason)")} — Timeout a member`,
  `${S.code("list_bans(guild_id)")} — List banned users with reasons`,
  `${S.code("get_audit_log(guild_id, limit, user_id, action_type)")} — Filtered audit log entries`,
])}

${S.p("<strong>Role operations:</strong>")}
${S.ul([
  `${S.code("list_roles(guild_id)")} — All roles with color, position, permissions`,
  `${S.code("create_role(guild_id, name)")} — Create a role`,
  `${S.code("delete_role(guild_id, role_id)")} — Delete a role`,
  `${S.code("assign_role(guild_id, user_id, role_id)")} — Assign role to member`,
  `${S.code("remove_role(guild_id, user_id, role_id)")} — Remove role from member`,
])}

${S.p("<strong>Invite operations:</strong>")}
${S.ul([
  `${S.code("create_invite(channel_id, max_age, max_uses)")} — Create invite link (max_age in seconds, 0 = never)`,
  `${S.code("list_invites(guild_id)")} — All active invites`,
  `${S.code("revoke_invite(code)")} — Revoke an invite immediately`,
])}

${S.p("<strong>Webhook operations:</strong>")}
${S.ul([
  `${S.code("list_webhooks(channel_id)")} — Webhooks in a channel`,
  `${S.code("create_webhook(channel_id, name)")} — Create a webhook`,
  `${S.code("delete_webhook(webhook_id)")} — Delete a webhook`,
  `${S.code("execute_webhook(webhook_id, token, content, username, avatar_url)")} — Post via webhook`,
])}

${S.p("<strong>RAG operations:</strong>")}
${S.ul([
  `${S.code("rag_ingest(channel_id, limit, table_name)")} — Ingest messages into LanceDB`,
  `${S.code("rag_query(query_text, top_k, table_name)")} — Semantic search over ingested messages`,
])}

${S.h2("discord_agentic_workflow(goal, ctx)")}
${S.p("Multi-step agentic task using MCP sampling. Describe a goal (e.g. 'moderate the last 24h in guild X'), and the server plans tool calls, executes them, and returns a structured result. Requires a configured sampling backend (Ollama or client LLM).")}

${S.h2("discord_help(topic)")}
${S.p("Returns context-aware documentation for any tool or operation. Call with a topic string (e.g. 'moderation', 'rag', 'rate_limits') to get targeted guidance from within your MCP client.")}
`,
  },
  RAG: {
    title: "RAG (LanceDB)",
    html: `
${S.h2("What is RAG?")}
${S.p("Retrieval-Augmented Generation lets you search Discord message history by meaning, not just keywords. The server downloads messages from a channel, generates embeddings using sentence-transformers (all-MiniLM-L6-v2), and stores them in a local LanceDB vector database.")}
${S.h2("Ingesting Messages")}
${S.p("Use the RAG page in the dashboard or call ") + S.code("rag_ingest(channel_id, limit=50)") + S.p(" from an MCP client. This fetches the most recent messages from the given channel and indexes them. Ingested data persists in data/discord_lancedb and survives server restarts.")}
${S.h2("Querying")}
${S.p("Call ") + S.code("rag_query(query_text, top_k=10)") + S.p(" with a natural language question. The server finds the top_k most semantically similar messages and returns them with channel name, author, and timestamp. The RAG page in the dashboard provides a search interface for browsing results.")}
${S.h2("Data Location")}
${S.p("LanceDB tables are stored at data/discord_lancedb by default. Override with LANCEDB_DISCORD_PATH environment variable. Each channel's messages go into a named table (default: discord_messages). You can use different table_name values to organize data from different channels or servers.")}
${S.h2("Performance Notes")}
${S.p("RAG requires sentence-transformers and its dependencies. The first call loads the model (takes a few seconds). Subsequent queries are fast. For channels with many messages, use a reasonable limit (50-100) per ingest call.")}
`,
  },
  "Env & Setup": {
    title: "Env & Setup",
    html: `
${S.h2("Required")}
${S.ul([
  `${S.code("DISCORD_TOKEN")} + S.p(" — Bot token from Discord Developer Portal (primary). ") + S.code("DISCORD_BOT_TOKEN") + S.p(" is accepted as fallback.")`,
  `${S.code("PORT")} + S.p(" — Backend port (default 10756).")`,
])}

${S.h2("Sampling (Agentic Workflows)")}
${S.ul([
  `${S.code("DISCORD_SAMPLING_BASE_URL")} + S.p(" — OpenAI-compatible endpoint for LLM sampling (default http://127.0.0.1:11434/v1 for Ollama).")`,
  `${S.code("DISCORD_SAMPLING_MODEL")} + S.p(" — Model name (default llama3.2).")`,
  `${S.code("DISCORD_SAMPLING_API_KEY")} + S.p(" — Bearer token for cloud or keyed local proxy.")`,
  `${S.code("DISCORD_SAMPLING_USE_OPENAI_KEY")} + S.p(" — Use OPENAI_API_KEY for sampling.")`,
  `${S.code("DISCORD_SAMPLING_USE_CLIENT_LLM")} + S.p(" — Prefer the MCP host's LLM for sampling (server handler becomes fallback).")`,
])}

${S.h2("Rate Limits (Anti-Spam)")}
${S.ul([
  `${S.code("DISCORD_RATE_LIMIT_MESSAGES_PER_MINUTE")} + S.p(" — Global cap (default 10).")`,
  `${S.code("DISCORD_RATE_LIMIT_MESSAGES_PER_CHANNEL_PER_MINUTE")} + S.p(" — Per-channel cap (default 3).")`,
  `${S.code("DISCORD_RATE_LIMIT_CHANNELS_PER_MINUTE")} + S.p(" — Channel creation cap (default 5).")`,
  `${S.code("DISCORD_RATE_LIMIT_INVITES_PER_MINUTE")} + S.p(" — Invite creation cap (default 5).")`,
  `${S.code("DISCORD_MAX_MESSAGE_LENGTH")} + S.p(" — Max characters per message (default 2000, Discord max).")`,
  `${S.code("DISCORD_MIN_MESSAGE_INTERVAL_SECONDS")} + S.p(" — Min seconds between sends (default 5).")`,
])}

${S.h2("Comms Lane (Inbound Watcher)")}
${S.ul([
  `${S.code("DISCORD_COMMS_AUTOSTART")} + S.p(" — Autostart the message watcher on boot (default 0).")`,
  `${S.code("DISCORD_COMMS_CHANNELS")} + S.p(" — Comma-separated channel snowflake IDs to watch.")`,
  `${S.code("DISCORD_COMMS_MODE")} + S.p(" — gateway (real-time via websocket) or poll (REST interval, default gateway).")`,
  `${S.code("DISCORD_COMMS_INTERVAL")} + S.p(" — Poll interval in seconds (default 30, only used in poll mode).")`,
  `${S.code("DISCORD_COMMS_WEBHOOK_URL")} + S.p(" — POST incoming messages to this URL.")`,
  `${S.code("DISCORD_COMMS_AUTO_REPLY")} + S.p(" — Auto-reply to messages (default 0).")`,
  `${S.code("DISCORD_COMMS_AUTO_REPLY_TEMPLATE")} + S.p(" — Template for auto-replies.")`,
])}

${S.h2("Other")}
${S.ul([
  `${S.code("LANCEDB_DISCORD_PATH")} + S.p(" — LanceDB storage path for RAG (default data/discord_lancedb).")`,
  `${S.code("DISCORD_TAURI")} + S.p(" — Set to 1 when running inside a Tauri WebView (adjusts CORS).")`,
])}
`,
  },
  FAQ: {
    title: "FAQ",
    html: `
${S.h2("Bot token not working?")}
${S.p("Ensure you copied the bot token from the Bot page in Discord Developer Portal, not the client secret from the General Information page. Bot tokens are longer strings starting with the application ID in base64. The server accepts DISCORD_TOKEN or DISCORD_BOT_TOKEN.")}

${S.h2("Permission denied / Missing Access?")}
${S.p("The bot needs the right permissions AND privileged intents enabled. Check two places: (1) In Developer Portal → Bot → Privileged Gateway Intents, toggle GUILD_MEMBERS and MESSAGE_CONTENT as needed. (2) After changing intents, regenerate the invite URL and re-invite the bot to each server (intents are baked into the OAuth2 URL).")}

${S.h2("Sampling shows 'Offline' or not ready?")}
${S.p("Start Ollama locally (ollama serve) or set DISCORD_SAMPLING_BASE_URL to an OpenAI-compatible endpoint. Set DISCORD_SAMPLING_MODEL to the model you want to use. If you prefer the MCP host's LLM, set DISCORD_SAMPLING_USE_CLIENT_LLM=1.")}

${S.h2("Rate limited / 429 errors?")}
${S.p("The server has two rate-limit layers. Server-side anti-spam (configurable via DISCORD_RATE_LIMIT_* env vars): max 10 messages/min global, 3/min per channel, 5s interval between sends, 5 channels/min, 5 invites/min. These return HTTP 429 with a message explaining which limit and the env var to override.")}
${S.p("Discord API rate limits (HTTP 429 with retry_after): the server auto-retries up to 5 times with exponential backoff and respects Discord's Retry-After header. If Discord keeps 429-ing you, slow down — Discord may temporarily ban the bot if you ignore their limits.")}

${S.h2("Port conflict?")}
${S.p("Ports are 10756 (backend) and 10757 (frontend). If something else is using them, kill zombies with: Get-NetTCPConnection -LocalPort 10756 | Stop-Process -Id {OwningProcess} -Force. Then re-run start.ps1.")}

${S.h2("Is AI/LLM usage allowed on Discord?")}
${S.p("Yes — bots can use LLMs to process messages, moderate, search history, and generate responses. This is what discord-mcp does: LLM as a tool to serve your community.")}
${S.p("Not allowed: scraping messages for external AI training, impersonating users with AI, spamming with LLM-generated floods, or selling Discord data via AI services. Our rate limits prevent the spam case. Keep LLM use scoped to your own servers and you're fine.")}

${S.h2("Backend won't start?")}
${S.p("Ensure all dependencies are installed. Run uv sync from the repo root. Check that Python 3.12+ is on PATH. Verify .env exists with DISCORD_TOKEN set. The backend logs startup errors to the console window.")}

${S.h2("How to export data?")}
${S.p("Every data page (Guilds, Channels, Messages, Members, Invites, Bans, Webhooks, Roles) has CSV and JSON export buttons in the top bar. Click to download the current view as a file.")}

${S.h2("Member list shows 'Requires GUILD_MEMBERS intent'?")}
${S.p("Enable the SERVER MEMBERS INTENT (GUILD_MEMBERS) in Discord Developer Portal → Application → Bot → Privileged Gateway Intents. After saving, regenerate your invite URL and re-invite the bot to the server.")}

${S.h2("Bot sees fewer guilds than I'm in?")}
${S.p("The dashboard shows guilds the bot can see, not guilds your user account can see. A bot only sees servers it has been invited to via the OAuth2 URL. Invite the bot to additional servers by opening the invite URL again and selecting another server.")}

${S.h2("10-server limit?")}
${S.p("Unverified bots can only join 10 servers. To raise the cap: Developer Portal → your application → Settings → Bot → Verification → fill out the form (description, screenshots, privacy policy URL). Once verified, the 100-server default applies.")}

${S.h2("How do guild masters add my bot?")}
${S.p("Send them the invite URL: https://discord.com/oauth2/authorize?client_id=1484336517261557900&permissions=8&scope=bot. They open it in a browser, pick their server from the dropdown, and click Authorise. The bot appears in their member list with a BOT tag.")}

${S.h2("What can the bot do in other servers?")}
${S.p("It depends on the permissions each guild master granted when they authorised the invite. The default URL requests Administrator (full access), but the guild master can reduce this during setup. The bot's effective permissions are per-guild — it might be admin in one server and read-only in another. You control it from your dashboard or MCP client; the guild master sees the bot in their member list.")}
${S.p("The bot token is global, but Discord enforces per-guild role permissions. If a guild master only granted 'Send Messages' and 'Read Message History', those are the only operations that work in that guild — moderation and management calls will return 403 Forbidden.")}

${S.h2("Bot sees 0 guilds?")}
${S.p("The bot has not been invited to any server yet. Go to Discord Developer Portal → OAuth2 → URL Generator, select the 'bot' scope, pick permissions (or use Administrator), open the generated URL, and select a server to invite the bot to.")}
`,
  },
};

export default function Help() {
  const [tab, setTab] = useState<Tab>("About Discord");
  const content = TAB_CONTENT[tab];

  return (
    <div className="space-y-6 py-4 max-w-4xl">
      <div className="flex items-center gap-4">
        <HelpCircle className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Help</h1>
          <p className="text-slate-400 text-sm">
            Discord MCP — FastMCP 3.2, 36 operations, RAG, agentic workflows
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "px-4 py-2 text-sm font-medium text-indigo-300 border-b-2 border-indigo-400"
                : "px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-300"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div
        className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5 space-y-3 text-sm text-slate-300 [&_h3]:text-white [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-5 [&_h3]:mb-2"
        dangerouslySetInnerHTML={{ __html: content.html }}
      />
    </div>
  );
}
