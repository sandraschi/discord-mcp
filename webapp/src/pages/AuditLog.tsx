import { AlertCircle, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type AuditEntry, type AuditLogResponse } from "../lib/api";
import { useGuildPicker } from "../lib/useGuildPicker";

/** Discord snowflakes embed the creation time: (id >> 22) + epoch. */
function snowflakeTime(id?: string): Date | null {
  if (!id) return null;
  try {
    return new Date(Number((BigInt(id) >> 22n) + 1420070400000n));
  } catch {
    return null;
  }
}

function formatTime(iso?: string, id?: string): string {
  const d = iso ? new Date(iso) : snowflakeTime(id);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Color-coded badge per action family: create=green, delete=red, update=amber, member=blue, invite=purple. */
const CREATE_CODES = new Set([10, 30, 50, 60, 80, 90, 100, 110, 140, 150, 151]);
const DELETE_CODES = new Set([12, 15, 32, 42, 52, 62, 70, 71, 74, 75, 82, 92, 102, 112, 142, 153, 154]);
const MEMBER_CODES = new Set([20, 21, 22, 23, 24, 25, 26, 27]);
const INVITE_CODES = new Set([40, 41, 42]);

function actionBadge(entry: AuditEntry) {
  const t = entry.action_type ?? -1;
  let cls = "bg-slate-500/15 text-slate-300 border-slate-500/30";
  if (CREATE_CODES.has(t)) cls = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  else if (DELETE_CODES.has(t)) cls = "bg-red-500/15 text-red-300 border-red-500/30";
  else if (MEMBER_CODES.has(t)) cls = "bg-blue-500/15 text-blue-300 border-blue-500/30";
  else if (INVITE_CODES.has(t)) cls = "bg-purple-500/15 text-purple-300 border-purple-500/30";
  else if (String(t).endsWith("1")) cls = "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {entry.action_label ?? `Action ${entry.action_type ?? "?"}`}
    </span>
  );
}

function nameCell(name?: string) {
  return <span className="text-slate-200">{name ?? "(deleted / unknown)"}</span>;
}

export default function AuditLog() {
  const { guilds, guildId, setGuildId, showPicker } = useGuildPicker();
  const [limit, setLimit] = useState(50);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setErr(null);
    api
      .getAuditLog(guildId, limit)
      .then((r: AuditLogResponse) => setEntries(r.entries ?? []))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [guildId, limit]);

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <ScrollText className="text-amber-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white">Audit log</h1>
          <p className="text-slate-400 text-sm">Discord's journal of who did what — moderation and admin actions, decoded</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        {showPicker && (
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
        )}
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
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 text-sm text-slate-300">Action</th>
                <th className="p-4 text-sm text-slate-300">Actor</th>
                <th className="p-4 text-sm text-slate-300">Target</th>
                <th className="p-4 text-sm text-slate-300">When</th>
                <th className="p-4 text-sm text-slate-300">Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id ?? `${e.user_id}-${e.action_type}`} className="border-b border-white/5">
                  <td className="p-4">{actionBadge(e)}</td>
                  <td className="p-4">{nameCell(e.user_name)}</td>
                  <td className="p-4">{nameCell(e.target_name)}</td>
                  <td className="p-4 text-slate-400 text-sm whitespace-nowrap">
                    {formatTime(e.created_at, e.id)}
                  </td>
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
