import { AlertCircle, Plus, Share2, ToggleLeft, ToggleRight, Trash2, Link, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type SlackMapping } from "../lib/api";

export default function Bridge() {
  const [mappings, setMappings] = useState<SlackMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [discordChannelId, setDiscordChannelId] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");

  const loadMappings = () => {
    setLoading(true);
    setErr(null);
    api.getSlackBridge()
      .then((data) => setMappings(data || []))
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load Slack bridge"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMappings();
  }, []);

  const handleAddMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discordChannelId.trim() || !slackWebhookUrl.trim()) return;

    const newMap: SlackMapping = {
      id: `map_${Math.random().toString(36).substring(2, 11)}`,
      discord_channel_id: discordChannelId.trim(),
      slack_webhook_url: slackWebhookUrl.trim(),
      active: true
    };

    const updated = [...mappings, newMap];
    saveMappingsPayload(updated);

    // Reset form
    setDiscordChannelId("");
    setSlackWebhookUrl("");
  };

  const handleDeleteMapping = (id: string) => {
    const updated = mappings.filter(m => m.id !== id);
    saveMappingsPayload(updated);
  };

  const handleToggleMapping = (id: string) => {
    const updated = mappings.map(m => m.id === id ? { ...m, active: !m.active } : m);
    saveMappingsPayload(updated);
  };

  const saveMappingsPayload = (payload: SlackMapping[]) => {
    setIsSaving(true);
    api.saveSlackBridge(payload)
      .then(() => {
        setMappings(payload);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to save Slack bridge"))
      .finally(() => setIsSaving(false));
  };

  return (
    <div className="space-y-8 py-4 max-w-5xl" data-testid="bridge-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Share2 className="text-indigo-400 w-8 h-8 animate-pulse" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Slack Bridge</h1>
            <p className="text-slate-400 text-sm">
              Cross-post Discord messages automatically to target Slack channels using webhooks.
            </p>
          </div>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{err}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Mappings List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h2 className="text-base font-bold text-white">Active Channel Mappings</h2>
              {isSaving && <span className="text-xs text-indigo-400 animate-pulse">Saving bridge…</span>}
            </div>

            {loading ? (
              <div className="text-xs text-slate-500 py-6 text-center">Loading mappings…</div>
            ) : mappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm text-center">
                <HelpCircle className="w-8 h-8 mb-2 opacity-30" />
                <p>No bridge mappings configured yet.</p>
                <p className="text-xs text-slate-600 mt-1">Use the panel on the right to configure a mapping.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mappings.map((map) => (
                  <div
                    key={map.id}
                    className={`rounded-xl border p-4 transition-all ${
                      map.active 
                        ? "bg-black/35 border-white/10" 
                        : "bg-black/10 border-white/5 opacity-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-indigo-400">Discord Channel</span>
                          <code className="bg-slate-800/80 px-2 py-0.5 rounded font-mono text-xs text-indigo-300">
                            {map.discord_channel_id}
                          </code>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
                          <Link className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="shrink-0">Slack Webhook:</span>
                          <span className="font-mono text-slate-300 truncate text-[11px] select-all bg-black/30 px-1.5 py-0.5 rounded" title={map.slack_webhook_url}>
                            {map.slack_webhook_url}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleMapping(map.id)}
                          title={map.active ? "Deactivate Bridge" : "Activate Bridge"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            map.active ? "text-indigo-400 hover:text-indigo-300" : "text-slate-600 hover:text-slate-500"
                          }`}
                        >
                          {map.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                        <button
                          onClick={() => handleDeleteMapping(map.id)}
                          title="Delete Mapping"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Create Mapping Form */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Bridge Constructor</h2>
            </div>

            <form onSubmit={handleAddMapping} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Discord Channel ID</label>
                <input
                  type="text"
                  placeholder="e.g. 11576298103"
                  value={discordChannelId}
                  onChange={(e) => setDiscordChannelId(e.target.value)}
                  className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Slack Incoming Webhook URL</label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 font-mono text-[11px]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!discordChannelId.trim() || !slackWebhookUrl.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" /> Establish Bridge Link
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
