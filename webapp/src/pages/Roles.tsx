import { AlertCircle, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Channel, type ChannelOverwrite, type Member, type Role } from "../lib/api";
import { useGuildPicker } from "../lib/useGuildPicker";

const OV_FLAGS = [
  { name: "VIEW_CHANNEL", bits: 1024, label: "View" },
  { name: "SEND_MESSAGES", bits: 2048, label: "Send" },
  { name: "READ_MESSAGE_HISTORY", bits: 65536, label: "History" },
  { name: "MANAGE_MESSAGES", bits: 8192, label: "Manage" },
] as const;

type TriState = "allow" | "inherit" | "deny";

function decodeOverwrite(o: ChannelOverwrite, bits: number): string {
  const allow = Number(o.allow ?? "0");
  const deny = Number(o.deny ?? "0");
  if ((allow & bits) !== 0) return "allow";
  if ((deny & bits) !== 0) return "deny";
  return "—";
}

export default function Roles() {
  const { guilds, guildId, setGuildId, showPicker } = useGuildPicker();
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsErr, setChannelsErr] = useState<string | null>(null);
  const [membersErr, setMembersErr] = useState<string | null>(null);
  const [ovChannelId, setOvChannelId] = useState("");
  const [ovRoleId, setOvRoleId] = useState("");
  const [ovFlags, setOvFlags] = useState<Record<string, TriState>>({
    VIEW_CHANNEL: "inherit",
    SEND_MESSAGES: "inherit",
    READ_MESSAGE_HISTORY: "inherit",
    MANAGE_MESSAGES: "inherit",
  });
  const [overwrites, setOverwrites] = useState<ChannelOverwrite[]>([]);
  const [ovLoading, setOvLoading] = useState(false);

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

  useEffect(() => {
    if (!guildId) return;
    api
      .getMembers(guildId, 1000)
      .then((r) => setMembers(r.members ?? []))
      .catch((e) => setMembersErr(e instanceof Error ? e.message : String(e)));
  }, [guildId]);

  useEffect(() => {
    if (!guildId) {
      setChannels([]);
      return;
    }
    setChannelsErr(null);
    api
      .getChannels(guildId)
      .then((r) => setChannels(r.channels ?? []))
      .catch((e) => setChannelsErr(e instanceof Error ? e.message : String(e)));
  }, [guildId]);

  const loadOverwrites = (channelId: string) => {
    if (!channelId) {
      setOverwrites([]);
      return;
    }
    setOvLoading(true);
    api
      .getChannel(channelId)
      .then((r) => setOverwrites(r.channel?.permission_overwrites ?? []))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setOvLoading(false));
  };

  useEffect(() => {
    loadOverwrites(ovChannelId);
  }, [ovChannelId]);

  const ovTargetName = (o: ChannelOverwrite) => {
    if (o.type === 0) return roles.find((r) => r.id === o.id)?.name ?? o.id;
    if (o.type === 1) return members.find((m) => m.user_id === o.id)?.username ?? o.id;
    return o.id;
  };

  const handleOverwriteApply = async () => {
    if (!ovChannelId || !ovRoleId) return;
    setErr(null);
    setMsg(null);
    let allow = 0;
    let deny = 0;
    for (const f of OV_FLAGS) {
      const v = ovFlags[f.name] ?? "inherit";
      if (v === "allow") allow |= f.bits;
      else if (v === "deny") deny |= f.bits;
    }
    try {
      await api.setChannelPermission(ovChannelId, ovRoleId, String(allow), String(deny), 0);
      setMsg("Channel overwrite saved");
      loadOverwrites(ovChannelId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const handleOverwriteClear = async () => {
    if (!ovChannelId || !ovRoleId) return;
    setErr(null);
    setMsg(null);
    try {
      await api.deleteChannelPermission(ovChannelId, ovRoleId);
      setMsg("Channel overwrite cleared");
      loadOverwrites(ovChannelId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

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
          <p className="text-slate-400 text-sm">Roles bundle permissions, colors, and labels — create, delete, and assign them</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{err}</p>
        </div>
      )}
      {msg && <p className="text-emerald-300 text-sm">{msg}</p>}

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
        <select
          value={assignUserId}
          onChange={(e) => setAssignUserId(e.target.value)}
          className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200 min-w-[180px]"
        >
          <option value="">Select member…</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.username}
              {m.nick ? ` (${m.nick})` : ""}
            </option>
          ))}
        </select>
        <select
          value={assignRoleId}
          onChange={(e) => setAssignRoleId(e.target.value)}
          className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200 min-w-[180px]"
        >
          <option value="">Select role…</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAssign}
          className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm"
        >
          Assign role
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4 space-y-3">
        <h2 className="text-white font-semibold">Channel access (overwrites)</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={ovChannelId}
            onChange={(e) => setOvChannelId(e.target.value)}
            className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200 min-w-[180px]"
          >
            <option value="">Select channel…</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <select
            value={ovRoleId}
            onChange={(e) => setOvRoleId(e.target.value)}
            className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200 min-w-[180px]"
          >
            <option value="">Select role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {OV_FLAGS.map((f) => (
            <label key={f.name} className="flex items-center gap-1.5 text-xs text-slate-400">
              {f.label}
              <select
                value={ovFlags[f.name] ?? "inherit"}
                onChange={(e) =>
                  setOvFlags((prev) => ({ ...prev, [f.name]: e.target.value as TriState }))
                }
                className="rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-slate-200 text-xs"
              >
                <option value="inherit">Inherit</option>
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
              </select>
            </label>
          ))}
          <button
            type="button"
            onClick={handleOverwriteApply}
            disabled={!ovChannelId || !ovRoleId}
            className="px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleOverwriteClear}
            disabled={!ovChannelId || !ovRoleId}
            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-50"
          >
            Clear
          </button>
        </div>
        {channelsErr && <p className="text-xs text-red-400">Channel list failed to load: {channelsErr}</p>}
        {membersErr && <p className="text-xs text-red-400">Member list failed to load: {membersErr}</p>}
        {ovLoading && <p className="text-slate-500 text-sm">Loading overwrites…</p>}
        {ovChannelId && !ovLoading && overwrites.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-2 text-slate-300">Target</th>
                {OV_FLAGS.map((f) => (
                  <th key={f.name} className="p-2 text-slate-300">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overwrites.map((o) => (
                <tr key={o.id} className="border-b border-white/5">
                  <td className="p-2 text-slate-200">{ovTargetName(o)}</td>
                  {OV_FLAGS.map((f) => (
                    <td key={f.name} className="p-2 text-slate-400">{decodeOverwrite(o, f.bits)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {loading && <p className="text-slate-400">Loading roles…</p>}

      {guildId && !loading && (
        <div className="rounded-2xl border border-white/10 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 text-sm text-slate-300">Name</th>
                <th className="p-4 text-sm text-slate-300">Position</th>
                <th className="p-4 text-sm text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="p-4 text-slate-200">{r.name}</td>
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
