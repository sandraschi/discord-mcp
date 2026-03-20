import { HelpCircle } from 'lucide-react'

export default function Help() {
  return (
    <div className="space-y-6 py-4 max-w-4xl">
      <div className="flex items-center gap-4">
        <HelpCircle className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Help</h1>
          <p className="text-slate-400 text-sm">Discord MCP — FastMCP 3.1, sampling, agentic</p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5 space-y-4 text-sm text-slate-300">
        <p><strong className="text-slate-200">Tools:</strong> discord(operation=...), discord_help(...), discord_agentic_workflow(goal, ctx).</p>
        <p><strong className="text-slate-200">Operations:</strong> list_guilds, list_channels, send_message, get_messages, get_guild_stats, create_channel, create_guild, create_invite (channel_id, max_age, max_uses), list_invites, revoke_invite (invite_code), list_members, get_member (guild_id, user_id; GUILD_MEMBERS intent).</p>
        <p><strong className="text-slate-200">Pages:</strong> Dashboard, Guilds, Channels, Invites, Members, Messages, Send message, Favorites, Trawl, RAG (LanceDB), Statistics, Settings, Help.</p>
      <p><strong className="text-slate-200">RAG:</strong> Ingest channel messages into LanceDB, then semantic search over ingested content (LanceDB is a required dependency).</p>
      <p><strong className="text-slate-200">Favorites / Trawl:</strong> Star guilds (Guilds) and channels (Channels). Favorites page: quick links. Trawl: fetch recent messages from favorite channels, optional keyword filter (e.g. &quot;release&quot;, &quot;announcement&quot;) for LM Studio–style release scanning.</p>
      <p><strong className="text-slate-200">Export:</strong> CSV and JSON on Guilds, Channels, Invites, Members, Messages, and Statistics.</p>
      <p><strong className="text-slate-200">Backend:</strong> http://localhost:10756 — MCP SSE + REST. Dashboard: http://localhost:10757.</p>
      </div>
    </div>
  )
}
