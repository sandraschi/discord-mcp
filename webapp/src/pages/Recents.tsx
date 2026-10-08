import { AlertCircle, ChevronDown, ChevronRight, History, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, type RecentChannel } from "../lib/api";
import { useGuildPicker } from "../lib/useGuildPicker";

function fmtTime(ts?: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

export default function Recents() {
  const { guildId } = useGuildPicker();
  const [items, setItems] = useState<RecentChannel[]>([]);
  const [totalChannels, setTotalChannels] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limitChannels, setLimitChannels] = useState(10);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    if (!guildId) {
      setItems([]);
      setTotalChannels(0);
      return;
    }
    setLoading(true);
    setErr(null);
    api
      .getRecent(guildId, limitChannels, 3, offset)
      .then((r) => {
        setItems(r.items ?? []);
        setTotalChannels(r.total_channels ?? 0);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [guildId, limitChannels, offset]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to first page when switching server or page size.
  useEffect(() => {
    setOffset(0);
    setExpanded(new Set());
  }, [guildId, limitChannels]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const from = totalChannels === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limitChannels, totalChannels);

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <History className="text-indigo-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Recents</h1>
            <p className="text-slate-400 text-sm">
              Latest notes per recently-active channel — no drill-down needed
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading || !guildId}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 inline-flex items-center gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="text-slate-300 text-sm font-medium">Channels per page</label>
        <select
          value={limitChannels}
          onChange={(e) => setLimitChannels(Number(e.target.value))}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
        {totalChannels > 0 && (
          <span className="text-slate-500 text-sm">
            {from}–{to} of {totalChannels} text channels
          </span>
        )}
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - limitChannels))}
            disabled={loading || offset === 0}
            className="px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => o + limitChannels)}
            disabled={loading || to >= totalChannels}
            className="px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {loading && <p className="text-slate-400">Loading recent activity…</p>}

      {!loading && guildId && items.length === 0 && !err && (
        <p className="text-slate-500 text-center py-8">No recent activity or no permission.</p>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((ch) => {
            const isOpen = expanded.has(ch.channel_id);
            const latest = ch.messages[0];
            return (
              <div key={ch.channel_id} className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(ch.channel_id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                  <span className="text-sm font-bold text-slate-200">#{ch.channel_name}</span>
                  <span className="text-xs text-slate-500">
                    {ch.messages.length} recent{ch.messages.length !== 1 ? "s" : ""}
                  </span>
                  {latest && (
                    <span className="text-xs text-slate-500 truncate flex-1 text-right">
                      {latest.author} · {fmtTime(latest.timestamp)} · {(latest.content || "").slice(0, 80) || "—"}
                    </span>
                  )}
                </button>
                {ch.error && (
                  <p className="px-4 pb-2 text-xs text-red-400">Channel read failed: {ch.error}</p>
                )}
                {isOpen && (
                  <div className="border-t border-white/5 divide-y divide-white/5">
                    {ch.messages.map((m) => (
                      <div key={m.id} className="px-4 py-2.5">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                          <span className="font-semibold text-slate-300">{m.author}</span>
                          <span>{fmtTime(m.timestamp)}</span>
                          {m.edited_timestamp && <span>(edited)</span>}
                        </div>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
                          {m.content || <span className="text-slate-600 italic">no text (embed/attachment only)</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
