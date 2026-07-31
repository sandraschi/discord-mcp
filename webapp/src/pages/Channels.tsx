import { AlertCircle, Download, Hash, MessageSquare, Plus, RefreshCw, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  api,
  type Channel,
  type ChannelsResponse,
} from "../lib/api";
import { exportCSV, exportJSON } from "../lib/export";
import { addChannel, getFavorites, removeChannel } from "../lib/favorites";
import { useGuildPicker } from "../lib/useGuildPicker";

const CHANNEL_TYPE_NAMES: Record<number, string> = {
  0: "Text",
  2: "Voice",
  4: "Category",
  5: "Announcement",
};

export default function Channels() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateGuildId = (location.state as { guildId?: string } | null)?.guildId;
  const {
    guilds,
    guildId: selectedGuildId,
    setGuildId: setSelectedGuildId,
    showPicker,
  } = useGuildPicker();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [favoriteChannelIds, setFavoriteChannelIds] = useState<Set<string>>(
    () => new Set(getFavorites().channels.map((c) => c.id)),
  );

  useEffect(() => {
    if (stateGuildId) setSelectedGuildId(stateGuildId);
  }, [stateGuildId]);

  useEffect(() => {
    if (!selectedGuildId) {
      setChannels([]);
      return;
    }
    setLoading(true);
    setErr(null);
    api
      .getChannels(selectedGuildId)
      .then((r: ChannelsResponse) => setChannels(r.channels ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [selectedGuildId]);

  const handleExportCSV = () => {
    const rows = channels.map((c) => ({
      id: c.id,
      name: c.name,
      type: CHANNEL_TYPE_NAMES[c.type] ?? c.type,
      guild_id: selectedGuildId,
    }));
    exportCSV(rows, `discord-channels-${selectedGuildId}.csv`);
  };
  const handleExportJSON = () => {
    exportJSON(
      { guild_id: selectedGuildId, channels, count: channels.length },
      `discord-channels-${selectedGuildId}.json`,
    );
  };

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedGuildId || !newName.trim()) return;
    setCreating(true);
    setCreateErr(null);
    try {
      await api.createChannel(selectedGuildId, newName.trim(), newType);
      setNewName("");
      setShowCreate(false);
      const r = await api.getChannels(selectedGuildId);
      setChannels(r.channels ?? []);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (channelId: string) => {
    if (!window.confirm("Delete this channel permanently?")) return;
    try {
      await api.deleteChannel(channelId);
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const guildName = guilds.find((g) => g.id === selectedGuildId)?.name ?? "";
  const toggleChannelFavorite = (c: Channel) => {
    if (favoriteChannelIds.has(c.id)) {
      removeChannel(c.id);
    } else {
      addChannel({
        id: c.id,
        guildId: selectedGuildId,
        name: c.name,
        guildName,
      });
    }
    setFavoriteChannelIds(new Set(getFavorites().channels.map((x) => x.id)));
  };

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Hash className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Channels
          </h1>
          <p className="text-slate-400 text-sm">List channels in a server</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {showPicker && (
          <>
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
          </>
        )}
        {selectedGuildId && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm"
            >
              <Download className="w-4 h-4" /> JSON
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm"
            >
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>
        )}
      </div>

      {showCreate && selectedGuildId && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">New Channel</h3>
            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="channel-name"
              className="rounded-xl bg-[#1a1a1e] border border-white/10 px-4 py-2 text-slate-200 min-w-[200px] flex-1"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(Number(e.target.value))}
              className="rounded-xl bg-[#1a1a1e] border border-white/10 px-4 py-2 text-slate-200"
            >
              <option value={0}>Text</option>
              <option value={2}>Voice</option>
              <option value={5}>Announcement</option>
            </select>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
          {createErr && <p className="text-xs text-red-400">{createErr}</p>}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading channels…
        </div>
      )}

      {selectedGuildId && !loading && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 w-10 text-sm font-bold text-slate-300"></th>
                <th className="p-4 text-sm font-bold text-slate-300">Name</th>
                <th className="p-4 text-sm font-bold text-slate-300">Type</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => toggleChannelFavorite(c)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-white/10 hover:text-amber-400"
                      title={
                        favoriteChannelIds.has(c.id)
                          ? "Remove from favorites"
                          : "Add to favorites (for Trawl)"
                      }
                    >
                      <Star
                        className="w-4 h-4"
                        fill={
                          favoriteChannelIds.has(c.id) ? "currentColor" : "none"
                        }
                      />
                    </button>
                  </td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => navigate("/messages", { state: { channelId: c.id } })}
                      className="font-medium text-slate-200 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
                      title="View messages"
                    >
                      {c.type === 0 && <MessageSquare className="w-3.5 h-3.5 text-slate-500" />}
                      {c.name}
                    </button>
                  </td>
                  <td className="p-4 text-slate-400">
                    {CHANNEL_TYPE_NAMES[c.type] ?? c.type}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:bg-red-500/20 hover:text-red-400"
                      title="Delete channel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {channels.length === 0 && (
            <p className="p-6 text-slate-500 text-center">
              No channels or no permission.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
