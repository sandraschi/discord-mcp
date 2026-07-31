import { AlertCircle, CheckCircle, Cpu, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Channel } from "../lib/api";
import { useGuildPicker } from "../lib/useGuildPicker";

export default function SendMessage() {
  const { guilds, guildId, setGuildId, showPicker } = useGuildPicker();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) return;
    api
      .getChannels(guildId)
      .then((r) =>
        setChannels((r.channels ?? []).filter((c) => c.type === 0 || c.type === 5)),
      )
      .catch(() => {});
  }, [guildId]);

  const channelName = channels.find((c) => c.id === channelId)?.name ?? channelId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId.trim() || !content.trim()) return;
    setLoading(true);
    setErr(null);
    setSuccess(null);
    api
      .sendMessage(channelId.trim(), content.trim())
      .then(() => {
        setSuccess(`Message sent to #${channelName}.`);
        setContent("");
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  const handleAiDraft = () => {
    if (!channelId.trim()) return;
    setDrafting(true);
    setErr(null);
    api
      .agentic(`Compose a short friendly message to send to channel #${channelName}`)
      .then((r) => {
        if (r.message) setContent(r.message);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Draft failed"))
      .finally(() => setDrafting(false));
  };

  return (
    <div className="space-y-6 py-4 max-w-2xl">
      <div className="flex items-center gap-4">
        <Send className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Send message
          </h1>
          <p className="text-slate-400 text-sm">
            Send a message to any channel (2000 char limit, rate-limited)
          </p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="channel-id" className="block text-slate-300 text-sm font-medium mb-2">
            Channel
          </label>
          <div className="flex gap-2">
            <div className="flex-1 flex flex-wrap gap-2">
              {showPicker && (
                <select
                  value={guildId}
                  onChange={(e) => setGuildId(e.target.value)}
                  className="flex-1 min-w-[160px] rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-3 text-slate-200"
                >
                  <option value="">Select server…</option>
                  {guilds.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                id="channel-id"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="flex-1 min-w-[180px] rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-3 text-slate-200"
                required
              >
                <option value="">Select channel…</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleAiDraft}
              disabled={drafting || !channelId.trim()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600/80 hover:bg-violet-500 disabled:opacity-50 text-white text-sm"
            >
              <Cpu className="w-4 h-4" />
              {drafting ? "Drafting…" : "AI draft"}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="content" className="block text-slate-300 text-sm font-medium mb-2">
            Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Message text…"
            rows={4}
            maxLength={2000}
            className="w-full rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-3 text-slate-200 resize-y"
            required
          />
          <p className="text-slate-500 text-xs mt-1">{content.length} / 2000</p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
        >
          <Send className="w-4 h-4" /> {loading ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
