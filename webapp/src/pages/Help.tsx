import { HelpCircle } from "lucide-react";
import { useState } from "react";

const TABS = ["Quick Start", "Operations", "RAG", "Settings", "FAQ"] as const;
type Tab = (typeof TABS)[number];

const TAB_CONTENT: Record<Tab, { title: string; lines: string[] }> = {
  "Quick Start": {
    title: "Quick Start",
    lines: [
      "Tools: discord(operation=...), discord_help(...), discord_agentic_workflow(goal, ctx).",
      "Create a bot at https://discord.com/developers/applications, copy the token, set DISCORD_TOKEN.",
      "Invite the bot to your server (OAuth2 URL Generator, scope: bot).",
      "Start server: uv run python -m discord_mcp.server --mode dual --port 10756.",
      "MCP endpoint: http://localhost:10756/mcp. Dashboard: http://localhost:10757.",
    ],
  },
  Operations: {
    title: "Operations",
    lines: [
      "list_guilds — Servers the bot can access.",
      "list_channels(guild_id) — Channels in a guild.",
      "send_message(channel_id, content) — Post a message (rate limited).",
      "get_messages(channel_id, limit=50) — Recent messages.",
      "get_guild_stats(guild_id) — Member + online count.",
      "create_channel(guild_id, name, channel_type) — 0=text, 2=voice, 4=category.",
      "create_invite(channel_id, max_age, max_uses) — Create invite link.",
      "list_invites(guild_id) / revoke_invite(invite_code).",
      "list_members / get_member (guild_id, user_id) — Requires GUILD_MEMBERS intent.",
      "list_active_threads(channel_id) — Active threads.",
      "create_guild(name) — User OAuth2 only; bot token returns 403.",
    ],
  },
  RAG: {
    title: "RAG (LanceDB)",
    lines: [
      "Ingest channel messages into LanceDB for semantic search.",
      "rag_ingest(channel_id, limit=50) → stores embeddings locally.",
      "rag_query(query_text, top_k=10) → finds semantically similar messages.",
      "Results are persisted in local LanceDB tables.",
    ],
  },
  Settings: {
    title: "Settings",
    lines: [
      "DISCORD_TOKEN — Bot token from Discord Developer Portal.",
      "DISCORD_SAMPLING_BASE_URL — Default http://127.0.0.1:11434/v1 (Ollama).",
      "DISCORD_SAMPLING_MODEL — Default llama3.2.",
      "DISCORD_SAMPLING_API_KEY — Optional Bearer token for cloud.",
      "DISCORD_SAMPLING_USE_CLIENT_LLM=1 — Prefer host LLM for sampling.",
      "Rate limits: DISCORD_RATE_LIMIT_* env vars adjust anti-spam thresholds.",
    ],
  },
  FAQ: {
    title: "FAQ",
    lines: [
      "Bot token not working? Ensure you copied the token, not the client secret.",
      "Permission denied? Ensure the bot has the required intents (GUILD_MEMBERS, MESSAGE_CONTENT).",
      "Sampling not ready? Start Ollama or set DISCORD_SAMPLING_BASE_URL / DISCORD_SAMPLING_USE_CLIENT_LLM=1.",
      "Port conflict? Ports are 10756 (backend) and 10757 (frontend). Kill zombies first.",
      "How to export? Every data page has CSV and JSON export buttons.",
    ],
  },
};

export default function Help() {
  const [tab, setTab] = useState<Tab>("Quick Start");
  const content = TAB_CONTENT[tab];

  return (
    <div className="space-y-6 py-4 max-w-4xl">
      <div className="flex items-center gap-4">
        <HelpCircle className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Help</h1>
          <p className="text-slate-400 text-sm">
            Discord MCP — FastMCP 3.2, sampling, agentic
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

      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5 space-y-3 text-sm text-slate-300">
        {content.lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}
