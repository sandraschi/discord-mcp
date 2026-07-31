import { AlertCircle, Calendar, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, type Channel } from "../lib/api";
import { useGuildPicker } from "../lib/useGuildPicker";

interface ScheduledMessage {
  id: number;
  guild_id: string;
  channel_id: string;
  content: string;
  scheduled_at: string;
  status: string;
  created_at: string;
  sent_at: string | null;
}

interface ScheduledListResponse {
  success: boolean;
  messages?: ScheduledMessage[];
  count?: number;
  error?: string;
}

export default function ScheduledMessages() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const { guilds, guildId, setGuildId, showPicker } = useGuildPicker();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [content, setContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  useEffect(() => {
    if (guildId) api.getChannels(guildId).then((r) => setChannels(r.channels?.filter((c: Channel) => c.type === 0) ?? [])).catch(() => {});
  }, [guildId]);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/v1/scheduled-messages?limit=100")
      .then((r) => r.json())
      .then((data: ScheduledListResponse) => setMessages(data.messages ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!channelId || !content.trim() || !scheduledAt) { setCreateErr("Fill all fields"); return; }
    setCreating(true); setCreateErr(null);
    try {
      const iso = new Date(scheduledAt).toISOString();
      const r = await fetch("/api/v1/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guild_id: guildId, channel_id: channelId, content: content.trim(), scheduled_at: iso }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail || "Failed"); }
      setShowCreate(false); setContent(""); setScheduledAt(""); setChannelId(""); setGuildId("");
      load();
    } catch (e) { setCreateErr(e instanceof Error ? e.message : String(e)); }
    finally { setCreating(false); }
  };

  const handleCancel = async (id: number) => {
    try {
      const r = await fetch(`/api/v1/scheduled-messages/${id}`, { method: "DELETE" });
      if (r.ok) setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {}
  };

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { pending: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", sent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", failed: "bg-rose-500/10 text-rose-400 border-rose-500/20", cancelled: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
    return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${m[s] || ""}`}>{s}</span>;
  };

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Calendar className="text-indigo-400 w-8 h-8" />
          <div><h1 className="text-2xl font-bold text-white tracking-tight">Scheduled Messages</h1><p className="text-slate-400 text-sm">Schedule messages to be sent at a future time</p></div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm"><Plus className="w-4 h-4" /> Schedule</button>
          <button type="button" onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-300 text-sm"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
      </div>

      {err && <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200"><AlertCircle className="w-5 h-5" /><p className="text-sm">{err}</p></div>}

      {showCreate && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5 space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-200">New Scheduled Message</h3><button type="button" onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button></div>
          <div className="flex flex-wrap gap-3">
            {showPicker && (
              <select value={guildId} onChange={(e) => setGuildId(e.target.value)} className="rounded-xl bg-[#1a1a1e] border border-white/10 px-4 py-2 text-slate-200 min-w-[180px] flex-1"><option value="">Guild</option>{guilds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            )}
            <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="rounded-xl bg-[#1a1a1e] border border-white/10 px-4 py-2 text-slate-200 min-w-[180px] flex-1"><option value="">Channel</option>{channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}</select>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="rounded-xl bg-[#1a1a1e] border border-white/10 px-4 py-2 text-slate-200 text-sm" />
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Message content..." rows={3} className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-slate-200" />
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleCreate} disabled={creating} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50">{creating ? "Scheduling..." : "Schedule"}</button>
            {createErr && <p className="text-xs text-red-400">{createErr}</p>}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm py-4">Loading...</p>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-8 text-center"><p className="text-slate-500 text-sm">No scheduled messages yet.</p></div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>#{m.channel_id.slice(0, 8)}</span>
                  <span>·</span>
                  <span>{new Date(m.scheduled_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(m.status)}
                  {m.status === "pending" && (
                    <button type="button" onClick={() => handleCancel(m.id)} className="p-1 rounded text-slate-600 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
