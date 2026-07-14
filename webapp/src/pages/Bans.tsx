import { AlertCircle, Ban } from "lucide-react";
import { useEffect, useState } from "react";
import {
  api,
  type BanEntry,
  type Guild,
  type GuildsResponse,
} from "../lib/api";

export default function Bans() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState("");
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getGuilds()
      .then((r: GuildsResponse) => setGuilds(r.guilds ?? []))
      .catch((e) => setErr(e.message));
  }, []);

  const loadBans = () => {
    if (!guildId) return;
    setLoading(true);
    setErr(null);
    api
      .getBans(guildId)
      .then((r) => setBans(r.bans ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBans();
  }, [guildId]);

  const handleBan = async () => {
    if (!guildId || !userId) return;
    setErr(null);
    setMsg(null);
    try {
      await api.banMember(guildId, userId, reason);
      setMsg(`Banned ${userId}`);
      setUserId("");
      loadBans();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUnban = async (id: string) => {
    if (!guildId) return;
    setErr(null);
    try {
      await api.unbanMember(guildId, id);
      setMsg(`Unbanned ${id}`);
      loadBans();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Ban className="text-red-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white">Bans</h1>
          <p className="text-slate-400 text-sm">List, ban, and unban members</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{err}</p>
        </div>
      )}
      {msg && <p className="text-emerald-300 text-sm">{msg}</p>}

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-slate-300 text-sm block mb-1">Guild</label>
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
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4 space-y-3">
        <h2 className="text-white font-semibold">Ban user</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID"
            className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200 min-w-[200px]"
          />
          <button
            type="button"
            onClick={handleBan}
            className="px-4 py-2 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-sm"
          >
            Ban
          </button>
        </div>
      </div>

      {loading && <p className="text-slate-400">Loading bans…</p>}

      {guildId && !loading && (
        <div className="rounded-2xl border border-white/10 overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 text-sm text-slate-300">Username</th>
                <th className="p-4 text-sm text-slate-300">User ID</th>
                <th className="p-4 text-sm text-slate-300">Reason</th>
                <th className="p-4 text-sm text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {bans.map((b) => (
                <tr key={b.user_id} className="border-b border-white/5">
                  <td className="p-4 text-slate-200">{b.username ?? "—"}</td>
                  <td className="p-4 font-mono text-sm text-slate-400">{b.user_id}</td>
                  <td className="p-4 text-slate-400 text-sm">{b.reason || "—"}</td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => b.user_id && handleUnban(b.user_id)}
                      className="text-sm text-indigo-300 hover:text-indigo-200"
                    >
                      Unban
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bans.length === 0 && (
            <p className="p-6 text-slate-500 text-center">No bans or missing BAN_MEMBERS permission.</p>
          )}
        </div>
      )}
    </div>
  );
}
