import { Activity, ArrowRight, Cpu, Database, Hash, History, Link2, MessageSquare, Network, Server, Shield, Users, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, type Health } from "../lib/api";
import { useServerStore } from "../store/serverStore";

export default function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null);
  const guilds = useServerStore((s) => s.guilds);
  const selectedGuildId = useServerStore((s) => s.selectedGuildId);
  const guildErr = useServerStore((s) => s.error);
  const loadGuilds = useServerStore((s) => s.loadGuilds);
  const [err, setErr] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [intents, setIntents] = useState<{ guild_members: boolean; message_content: boolean } | null>(null);
  const [ragChunks, setRagChunks] = useState<number | null>(null);
  const [infoErr, setInfoErr] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (guilds.length === 0) loadGuilds().catch(() => {});
  }, [guilds.length, loadGuilds]);

  // Per-server info cards + RAG. allSettled: partial data still renders,
  // failures collapse into one visible note instead of silent blanks.
  useEffect(() => {
    if (!selectedGuildId) {
      setMemberCount(null);
      setOnlineCount(null);
      setChannelCount(null);
      setIntents(null);
      return;
    }
    let active = true;
    Promise.allSettled([
      api.getGuildStats(selectedGuildId),
      api.getChannels(selectedGuildId),
      api.getIntents(),
      api.getRagStats(),
    ]).then(([stats, channels, intentRes, rag]) => {
      if (!active) return;
      const problems: string[] = [];
      if (stats.status === "fulfilled") {
        setMemberCount(stats.value.member_count ?? null);
        setOnlineCount(stats.value.online_count ?? null);
      } else {
        setMemberCount(null);
        setOnlineCount(null);
        problems.push(`stats: ${stats.reason instanceof Error ? stats.reason.message : String(stats.reason)}`);
      }
      if (channels.status === "fulfilled") {
        setChannelCount(channels.value.channels?.length ?? null);
      } else {
        setChannelCount(null);
        problems.push(`channels: ${channels.reason instanceof Error ? channels.reason.message : String(channels.reason)}`);
      }
      if (intentRes.status === "fulfilled") {
        setIntents(intentRes.value.intents ?? null);
      } else {
        setIntents(null);
        problems.push(`intents: ${intentRes.reason instanceof Error ? intentRes.reason.message : String(intentRes.reason)}`);
      }
      if (rag.status === "fulfilled") {
        setRagChunks(rag.value.total_chunks ?? null);
      } else {
        setRagChunks(null);
        problems.push(`rag: ${rag.reason instanceof Error ? rag.reason.message : String(rag.reason)}`);
      }
      setInfoErr(problems.length > 0 ? problems.join(" · ") : null);
    });
    return () => {
      active = false;
    };
  }, [selectedGuildId]);

  useEffect(() => {
    let active = true;
    let timerId: number | undefined;

    const fetchData = () => {
      api
        .getHealth()
        .then((h) => {
          if (!active) return;
          setHealth(h);
          setErr(null);
        })
        .catch((e) => {
          if (!active) return;
          setErr(e.message);
          timerId = window.setTimeout(fetchData, 2000);
        });
    };

    fetchData();

    return () => {
      active = false;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [location.pathname]);

  const rl = health?.rate_limit;
  const samp = health?.sampling;
  const guildName =
    guilds.find((g) => g.id === selectedGuildId)?.name ??
    (guilds.length === 1 ? guilds[0].name : null);
  const uptime = health?.uptime_seconds ?? 0;
  const uptimeStr = uptime >= 86400
    ? `${Math.floor(uptime / 86400)}d`
    : uptime >= 3600
    ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
    : uptime >= 60
    ? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
    : `${uptime}s`;

  return (
    <div className="space-y-6 pb-8 max-w-5xl">
      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}. Run start.ps1 to start the backend.</p>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-950/60 via-[#0f0f12]/80 to-slate-950/80 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <img
                src="https://cdn.prod.website-files.com/6257adef93867e50d84b3fbf/65a4560c37c4b37a2b5e24f5_Discord-Logo-Color.png"
                alt="Discord"
                className="w-6 h-6 opacity-80"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {guildName ? `${guildName}` : "Discord MCP"}
              </h1>
              <p className="text-sm text-slate-400">
                {health?.service ?? "discord-mcp"} v{health?.version ?? "?"}
              </p>
            </div>
          </div>

          <p className="text-slate-400 text-sm mt-3 max-w-xl leading-relaxed">
            Manage your Discord server from MCP clients — send messages,
            moderate members, manage channels and roles, search history with RAG,
            and run agentic workflows.
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: "Send Message", icon: MessageSquare, to: "/send" },
              { label: "Recents", icon: History, to: "/recents" },
              { label: "Server tree", icon: Network, to: "/tree" },
              { label: "Create Channel", icon: Hash, to: "/channels" },
              { label: "Invites", icon: Link2, to: "/invites" },
              { label: "RAG search", icon: Database, to: "/rag" },
            ].map(({ label, icon: Icon, to }) => (
              <button
                key={to}
                type="button"
                onClick={() => navigate(to)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm transition-colors"
              >
                <Icon className="w-4 h-4" />
                {label}
                <ArrowRight className="w-3 h-3 ml-1 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Server className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-200">Guilds</h2>
          </div>
          <p className="text-2xl font-bold text-white">{guilds.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            Servers the bot can access
            {guildErr ? <span className="text-amber-400"> — {guildErr}</span> : null}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-200">Backend</h2>
          </div>
          <p className="text-2xl font-bold text-white">
            {health?.status === "ok" ? "Online" : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Uptime: {uptimeStr}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-bold text-slate-200">Bot Token</h2>
          </div>
          <p className="text-2xl font-bold text-white">
            {health?.token_set ? "Set" : "Not set"}
          </p>
          <p className="text-xs text-slate-500 mt-1">DISCORD_TOKEN in .env</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-bold text-slate-200">Sampling</h2>
          </div>
          <p className="text-2xl font-bold text-white">
            {samp?.server_side_llm_ready ? "Ready" : "Offline"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {samp?.sampling_model ?? "—"} @ {samp?.sampling_base_url ?? "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-bold text-slate-200">Members</h2>
          </div>
          <p className="text-2xl font-bold text-white">
            {memberCount ?? "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {onlineCount !== null ? `${onlineCount} online` : selectedGuildId ? "No data" : "Select a server"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Hash className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-slate-200">Channels</h2>
          </div>
          <p className="text-2xl font-bold text-white">
            {channelCount ?? "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {selectedGuildId ? "Text, voice, categories" : "Select a server"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-200">Intents</h2>
          </div>
          <p className="text-2xl font-bold text-white">
            {intents === null ? "—" : intents.guild_members && intents.message_content ? "Full" : "Partial"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {intents === null
              ? "No data"
              : `Members: ${intents.guild_members ? "on" : "OFF"} · Content: ${intents.message_content ? "on" : "OFF"}`}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-bold text-slate-200">RAG chunks</h2>
          </div>
          <p className="text-2xl font-bold text-white">
            {ragChunks ?? "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Indexed Discord messages
          </p>
        </div>
      </div>

      {infoErr && (
        <p className="text-xs text-amber-400/90">Partial dashboard data: {infoErr}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Webhook className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-200">MCP HTTP</h2>
          </div>
          <p className="text-sm font-mono text-indigo-300/90 break-all">
            {health?.mcp_http_path
              ? `http://localhost:10756${health.mcp_http_path}`
              : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Streamable HTTP (FastMCP 3.2)
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 sm:col-span-2 lg:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-200">Rate Limits</h2>
          </div>
          {rl ? (
            <ul className="text-xs text-slate-400 space-y-0.5 grid sm:grid-cols-2 gap-x-8">
              <li>Messages: {rl.messages_per_minute}/min, {rl.messages_per_channel_per_minute}/channel</li>
              <li>Channels: {rl.channels_per_minute}/min</li>
              <li>Invites: {rl.invites_per_minute}/min</li>
              <li>Min interval: {rl.min_message_interval_seconds}s</li>
            </ul>
          ) : (
            <p className="text-slate-500 text-sm">—</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
