import { AlertCircle, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import {
  api,
  type Guild,
  type GuildsResponse,
  type Role,
} from "../lib/api";

export default function Roles() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getGuilds()
      .then((r: GuildsResponse) => setGuilds(r.guilds ?? []))
      .catch((e) => setErr(e.message));
  }, []);

  const loadRoles = () => {
    if (!guildId) return;
    setLoading(true);
    setErr(null);
    api
      .getRoles(guildId)
      .then((r) => setRoles(r.roles ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRoles();
  }, [guildId]);

  const handleCreate = async () => {
    if (!guildId || !newRoleName.trim()) return;
    try {
      await api.createRole(guildId, newRoleName.trim());
      setNewRoleName("");
      setMsg("Role created");
      loadRoles();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!guildId) return;
    try {
      await api.deleteRole(guildId, roleId);
      setMsg(`Deleted role ${roleId}`);
      loadRoles();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAssign = async () => {
    if (!guildId || !assignUserId || !assignRoleId) return;
    try {
      await api.assignRole(guildId, assignUserId, assignRoleId);
      setMsg("Role assigned");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Shield className="text-violet-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white">Roles</h1>
          <p className="text-slate-400 text-sm">List, create, delete, and assign roles</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{err}</p>
        </div>
      )}
      {msg && <p className="text-emerald-300 text-sm">{msg}</p>}

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

      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4 flex flex-wrap gap-3">
        <input
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          placeholder="New role name"
          className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm"
        >
          Create role
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4 flex flex-wrap gap-3">
        <input
          value={assignUserId}
          onChange={(e) => setAssignUserId(e.target.value)}
          placeholder="User ID"
          className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200"
        />
        <input
          value={assignRoleId}
          onChange={(e) => setAssignRoleId(e.target.value)}
          placeholder="Role ID"
          className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200"
        />
        <button
          type="button"
          onClick={handleAssign}
          className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm"
        >
          Assign role
        </button>
      </div>

      {loading && <p className="text-slate-400">Loading roles…</p>}

      {guildId && !loading && (
        <div className="rounded-2xl border border-white/10 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 text-sm text-slate-300">Name</th>
                <th className="p-4 text-sm text-slate-300">ID</th>
                <th className="p-4 text-sm text-slate-300">Position</th>
                <th className="p-4 text-sm text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="p-4 text-slate-200">{r.name}</td>
                  <td className="p-4 font-mono text-sm text-slate-400">{r.id}</td>
                  <td className="p-4 text-slate-400">{r.position ?? "—"}</td>
                  <td className="p-4">
                    {!r.managed && (
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="text-sm text-red-300 hover:text-red-200"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
