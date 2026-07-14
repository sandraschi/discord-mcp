import { AlertCircle, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import {
  api,
  type AuditEntry,
  type Guild,
  type GuildsResponse,
} from "../lib/api";

export default function AuditLog() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState("");
  const [limit, setLimit] = useState(50);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .getGuilds()
      .then((r: GuildsResponse) => setGuilds(r.guilds ?? []))
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!guildId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setErr(null);
    api
      .getAuditLog(guildId, limit)
      .then((r) => setEntries(r.entries ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [guildId, limit]);

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <ScrollText className="text-amber-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white">Audit log</h1>
          <p className="text-slate-400 text-sm">Recent moderation and admin actions</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <select
          value={guildId}
          onChange={(e) => setGuildId(e.target.value)}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200 min-w-[200px]"
        >
          <option value="">Select server</option>
          {guilds.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      {loading && <p className="text-slate-400">Loading audit log…</p>}

      {guildId && !loading && (
        <div className="rounded-2xl border border-white/10 overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 text-sm text-slate-300">Action</th>
                <th className="p-4 text-sm text-slate-300">Actor</th>
                <th className="p-4 text-sm text-slate-300">Target</th>
                <th className="p-4 text-sm text-slate-300">Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id ?? `${e.user_id}-${e.action_type}`} className="border-b border-white/5">
                  <td className="p-4 text-slate-200">{e.action_type ?? "—"}</td>
                  <td className="p-4 font-mono text-sm text-slate-400">{e.user_id ?? "—"}</td>
                  <td className="p-4 font-mono text-sm text-slate-400">{e.target_id ?? "—"}</td>
                  <td className="p-4 text-slate-400 text-sm">{e.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <p className="p-6 text-slate-500 text-center">No entries or missing VIEW_AUDIT_LOG permission.</p>
          )}
        </div>
      )}
    </div>
  );
}
