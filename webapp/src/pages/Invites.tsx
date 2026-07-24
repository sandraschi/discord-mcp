import { AlertCircle, Copy, Download, Link2, Plus, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  api,
  type Channel,
  type ChannelsResponse,
  type Guild,
  type GuildsResponse,
  type Invite,
  type InvitesResponse,
} from "../lib/api";
import { exportCSV, exportJSON } from "../lib/export";

export default function Invites() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [invChannelId, setInvChannelId] = useState("");
  const [invMaxAge, setInvMaxAge] = useState(86400);
  const [invMaxUses, setInvMaxUses] = useState(0);
  const [invCreating, setInvCreating] = useState(false);
  const [invCreateErr, setInvCreateErr] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchChannels = (guildId: string) => {
    api.getChannels(guildId).then((r: ChannelsResponse) => {
      setChannels(r.channels?.filter((c) => c.type === 0) ?? []);
    }).catch(() => {});
  };

  useEffect(() => {
    api
      .getGuilds()
      .then((r: GuildsResponse) => setGuilds(r.guilds ?? []))
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!selectedGuildId) {
      setInvites([]);
      setChannels([]);
      return;
    }
    setLoading(true);
    setErr(null);
    api
      .getInvites(selectedGuildId)
      .then((r: InvitesResponse) => setInvites(r.invites ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
    fetchChannels(selectedGuildId);
  }, [selectedGuildId]);

  const handleCreate = async () => {
    if (!invChannelId) { setInvCreateErr("Select a channel"); return; }
    setInvCreating(true);
    setInvCreateErr(null);
    setCreatedUrl(null);
    try {
      const r = await api.createInvite(invChannelId, invMaxAge, invMaxUses);
      setCreatedUrl(r.url ?? `https://discord.gg/${r.code}`);
      setShowCreate(false);
      if (selectedGuildId) {
        const r2 = await api.getInvites(selectedGuildId);
        setInvites(r2.invites ?? []);
      }
    } catch (e) {
      setInvCreateErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setInvCreating(false);
    }
  };

  const handleExportCSV = () => {
    const rows = invites.map((i) => ({
      code: i.code,
      url: i.url,
      uses: i.uses ?? "",
      max_uses: i.max_uses ?? "",
      inviter: i.inviter ?? "",
    }));
    exportCSV(rows, `discord-invites-${selectedGuildId}.csv`);
  };
  const handleExportJSON = () => {
    exportJSON(
      { guild_id: selectedGuildId, invites, count: invites.length },
      `discord-invites-${selectedGuildId}.json`,
    );
  };

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link2 className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Invites
          </h1>
          <p className="text-slate-400 text-sm">
            List and export invite links by guild
          </p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label htmlFor="guild-select" className="text-slate-300 text-sm font-medium">Guild</label>
        <select
          id="guild-select"
          value={selectedGuildId}
          onChange={(e) => setSelectedGuildId(e.target.value)}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200 min-w-[200px]"
        >
          <option value="">Select a server</option>
          {guilds.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {selectedGuildId && (
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setShowCreate(!showCreate); setCreatedUrl(null); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm"
            >
              <Plus className="w-4 h-4" /> Create Invite
            </button>
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                try { const r = await api.getInvites(selectedGuildId); setInvites(r.invites ?? []); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
                setLoading(false);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-300 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {invites.length > 0 && (
              <>
                <button type="button" onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm">
                  <Download className="w-4 h-4" /> CSV
                </button>
                <button type="button" onClick={handleExportJSON} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm">
                  <Download className="w-4 h-4" /> JSON
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showCreate && selectedGuildId && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">New Invite Link</h3>
            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={invChannelId}
              onChange={(e) => setInvChannelId(e.target.value)}
              className="rounded-xl bg-[#1a1a1e] border border-white/10 px-4 py-2 text-slate-200 min-w-[200px] flex-1"
            >
              <option value="">Select a text channel</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
            <input
              type="number" placeholder="Max age (s)" value={invMaxAge}
              onChange={(e) => setInvMaxAge(Number(e.target.value))}
              className="w-28 rounded-xl bg-[#1a1a1e] border border-white/10 px-3 py-2 text-slate-200 text-sm"
            />
            <input
              type="number" placeholder="Max uses (0=unlimited)" value={invMaxUses}
              onChange={(e) => setInvMaxUses(Number(e.target.value))}
              className="w-28 rounded-xl bg-[#1a1a1e] border border-white/10 px-3 py-2 text-slate-200 text-sm"
            />
            <button
              type="button" onClick={handleCreate} disabled={invCreating || !invChannelId}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50"
            >
              {invCreating ? "Creating..." : "Create"}
            </button>
          </div>
          {invCreateErr && <p className="text-xs text-red-400">{invCreateErr}</p>}
        </div>
      )}

      {createdUrl && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
          <span className="text-sm text-emerald-300 font-mono break-all flex-1">{createdUrl}</span>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(createdUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-xs"
          >
            <Copy className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {loading && <p className="text-slate-400">Loading invites…</p>}

      {selectedGuildId && !loading && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 text-sm font-bold text-slate-300">Code</th>
                <th className="p-4 text-sm font-bold text-slate-300">URL</th>
                <th className="p-4 text-sm font-bold text-slate-300">Uses</th>
                <th className="p-4 text-sm font-bold text-slate-300">
                  Inviter
                </th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr
                  key={i.code}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-4 font-mono text-sm text-slate-300">
                    {i.code}
                  </td>
                  <td className="p-4">
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline truncate max-w-[200px] block"
                    >
                      {i.url}
                    </a>
                  </td>
                  <td className="p-4 text-slate-400">
                    {(i.uses ?? 0) > 0
                      ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Used {i.uses}x</span>
                      : <span className="text-slate-500">0 / {i.max_uses ?? "∞"}</span>
                    }
                  </td>
                  <td className="p-4 text-slate-400">{i.inviter ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {invites.length === 0 && (
            <p className="p-6 text-slate-500 text-center">
              No invites or no permission (Manage Server).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
