import { AlertCircle, Radio, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type CommsWatcherStatus } from "../lib/api";

export default function Comms() {
  const [status, setStatus] = useState<CommsWatcherStatus | null>(null);
  const [channelIds, setChannelIds] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("http://127.0.0.1:10956/api/alerts");
  const [mode, setMode] = useState("gateway");
  const [interval, setInterval] = useState(30);
  const [autoReply, setAutoReply] = useState(false);
  const [template, setTemplate] = useState("Thanks {author} — received your message.");
  const [autoRag, setAutoRag] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTz, setScheduleTz] = useState("Europe/Vienna");
  const [scheduleDays, setScheduleDays] = useState("wd");
  const [scheduleStart, setScheduleStart] = useState("09:00");
  const [scheduleEnd, setScheduleEnd] = useState("17:30");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    api
      .getCommsWatcherStatus()
      .then(setStatus)
      .catch((e) => setErr(e.message));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleStart = async () => {
    const ids = channelIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      setErr("Enter at least one channel ID");
      return;
    }
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const out = await api.startCommsWatcher({
        mode,
        interval,
        webhook_url: webhookUrl,
        channels: ids.map((channel_id) => ({ channel_id })),
        auto_reply: autoReply,
        auto_reply_template: template,
        auto_rag: autoRag,
        schedule: scheduleEnabled
          ? { tz: scheduleTz, windows: [{ days: scheduleDays, start: scheduleStart, end: scheduleEnd }] }
          : undefined,
      });
      setStatus(out);
      setMsg(out.message ?? "Watcher started");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setErr(null);
    try {
      const out = await api.stopCommsWatcher();
      setStatus(out);
      setMsg(out.message ?? "Watcher stopped");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 py-4 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Radio className="text-emerald-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white">Comms watcher</h1>
            <p className="text-slate-400 text-sm">
              Inbound Discord → robofang / fleet-agent webhook
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 text-slate-300 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{err}</p>
        </div>
      )}
      {msg && <p className="text-emerald-300 text-sm">{msg}</p>}

      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5 space-y-4">
        <p className="text-sm text-slate-400">
          Status:{" "}
          <span className={status?.running ? "text-emerald-400" : "text-slate-500"}>
            {status?.running ? "Running" : "Stopped"}
          </span>
        </p>
        {status?.running && status.config && (
          <p className="text-xs text-slate-500">
            mode={status.config.mode}
            {status.config.auto_rag ? " | auto-rag: on" : ""}
            {status.config.schedule?.windows?.length
              ? ` | active: ${status.config.schedule.windows
                  .map((w) => `${w.days} ${w.start}-${w.end}`)
                  .join(", ")}`
              : " | active: always"}
          </p>
        )}

        <div className="space-y-2">
          <label className="text-slate-300 text-sm">Channel IDs (comma-separated)</label>
          <input
            value={channelIds}
            onChange={(e) => setChannelIds(e.target.value)}
            placeholder="123456789012345678"
            className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200"
          />
        </div>

        <div className="space-y-2">
          <label className="text-slate-300 text-sm">Webhook URL (robofang)</label>
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-slate-300 text-sm block mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200"
            >
              <option value="gateway">gateway</option>
              <option value="poll">poll</option>
            </select>
          </div>
          <div>
            <label className="text-slate-300 text-sm block mb-1">Poll interval (s)</label>
            <input
              type="number"
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="w-24 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-slate-300 text-sm">
          <input type="checkbox" checked={autoReply} onChange={(e) => setAutoReply(e.target.checked)} />
          Auto-reply in channel
        </label>
        {autoReply && (
          <input
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200 text-sm"
          />
        )}

        <label className="flex items-center gap-2 text-slate-300 text-sm">
          <input type="checkbox" checked={autoRag} onChange={(e) => setAutoRag(e.target.checked)} />
          Auto-RAG ingest (messages into LanceDB) - default off
        </label>

        <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
          <label className="flex items-center gap-2 text-slate-300 text-sm font-medium">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
            />
            Active-window schedule (only process messages in these hours)
          </label>
          {scheduleEnabled && (
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs block mb-1">Timezone</label>
                <input
                  value={scheduleTz}
                  onChange={(e) => setScheduleTz(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Days</label>
                  <select
                    value={scheduleDays}
                    onChange={(e) => setScheduleDays(e.target.value)}
                    className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200 text-sm"
                  >
                    <option value="wd">Weekdays (Mon-Fri)</option>
                    <option value="we">Weekends</option>
                    <option value="all">Every day</option>
                    <option value="0,1,2,3,4">Mon-Fri (explicit)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Start (HH:MM)</label>
                  <input
                    type="time"
                    value={scheduleStart}
                    onChange={(e) => setScheduleStart(e.target.value)}
                    className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">End (HH:MM)</label>
                  <input
                    type="time"
                    value={scheduleEnd}
                    onChange={(e) => setScheduleEnd(e.target.value)}
                    className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-slate-200 text-sm"
                  />
                </div>
              </div>
              <p className="text-slate-500 text-xs">
                Outside the window the watcher stays connected but does not dispatch
                webhooks, auto-replies, RAG, or rules. End before start = overnight window.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={handleStart}
            className="px-4 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white text-sm disabled:opacity-50"
          >
            Start watch
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleStop}
            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-50"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
