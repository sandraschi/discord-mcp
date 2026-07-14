import { AlertCircle, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import {
  api,
  type Channel,
  type ChannelsResponse,
  type Guild,
  type GuildsResponse,
  type Webhook as WebhookEntry,
} from "../lib/api";

export default function WebhooksPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [webhookName, setWebhookName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getGuilds()
      .then((r: GuildsResponse) => setGuilds(r.guilds ?? []))
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!guildId) {
      setChannels([]);
      setChannelId("");
      return;
    }
    api
      .getChannels(guildId)
      .then((r: ChannelsResponse) => setChannels(r.channels ?? []))
      .catch((e) => setErr(e.message));
  }, [guildId]);

  const loadWebhooks = () => {
    if (!channelId) return;
    setLoading(true);
    setErr(null);
    api
      .getWebhooks(channelId)
      .then((r) => setWebhooks(r.webhooks ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadWebhooks();
  }, [channelId]);

  const handleCreate = async () => {
    if (!channelId || !webhookName.trim()) return;
    try {
      await api.createWebhook(channelId, webhookName.trim());
      setWebhookName("");
      setMsg("Webhook created");
      loadWebhooks();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteWebhook(id);
      setMsg(`Deleted webhook ${id}`);
      loadWebhooks();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Webhook className="text-cyan-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white">Webhooks</h1>
          <p className="text-slate-400 text-sm">List, create, and delete channel webhooks</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{err}</p>
        </div>
      )}
      {msg && <p className="text-emerald-300 text-sm">{msg}</p>}

      <div className="flex flex-wrap gap-4">
        <select
          value={guildId}
          onChange={(e) => setGuildId(e.target.value)}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200"
        >
          <option value="">Select server</option>
          {guilds.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200 min-w-[200px]"
        >
          <option value="">Select channel</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4 flex flex-wrap gap-3">
        <input
          value={webhookName}
          onChange={(e) => setWebhookName(e.target.value)}
          placeholder="Webhook name"
          className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="px-4 py-2 rounded-xl bg-cyan-700/80 hover:bg-cyan-600 text-white text-sm"
        >
          Create webhook
        </button>
      </div>

      {loading && <p className="text-slate-400">Loading webhooks…</p>}

      {channelId && !loading && (
        <div className="rounded-2xl border border-white/10 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 text-sm text-slate-300">Name</th>
                <th className="p-4 text-sm text-slate-300">ID</th>
                <th className="p-4 text-sm text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id} className="border-b border-white/5">
                  <td className="p-4 text-slate-200">{w.name ?? "—"}</td>
                  <td className="p-4 font-mono text-sm text-slate-400">{w.id}</td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => handleDelete(w.id)}
                      className="text-sm text-red-300 hover:text-red-200"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {webhooks.length === 0 && (
            <p className="p-6 text-slate-500 text-center">No webhooks in this channel.</p>
          )}
        </div>
      )}
    </div>
  );
}
