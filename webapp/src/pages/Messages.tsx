import {
  AlertCircle,
  Clipboard,
  Download,
  FileText,
  MessageCircle,
  MessageSquare,
  Pin,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import MessageViewer, { type ViewMode } from "../components/MessageViewer";
import { api, type Channel, type Message, type MessagesResponse, type Thread } from "../lib/api";
import { exportCSV, exportJSON } from "../lib/export";
import { useGuildPicker } from "../lib/useGuildPicker";

export default function Messages() {
  const { guilds, guildId, setGuildId, showPicker } = useGuildPicker();
  const [channels, setChannels] = useState<Channel[]>([]);
  const location = useLocation();
  const stateChannelId =
    (location.state as { channelId?: string } | null)?.channelId ?? "";
  const [channelId, setChannelId] = useState(stateChannelId);
  const [channelsErr, setChannelsErr] = useState<string | null>(null);
  const [modBusy, setModBusy] = useState<string | null>(null);
  useEffect(() => {
    if (stateChannelId) setChannelId(stateChannelId);
  }, [stateChannelId]);
  useEffect(() => {
    if (!guildId) return;
    setChannelsErr(null);
    api
      .getChannels(guildId)
      .then((r) =>
        setChannels((r.channels ?? []).filter((c) => c.type === 0 || c.type === 5)),
      )
      .catch((e) => setChannelsErr(e instanceof Error ? e.message : String(e)));
  }, [guildId]);
  const [limit, setLimit] = useState(50);
  const [data, setData] = useState<MessagesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [pins, setPins] = useState<Message[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [exportMd, setExportMd] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadExport = async () => {
    if (!channelId.trim()) return;
    setExportLoading(true);
    setExportMd(null);
    try {
      const r = await api.exportMessagesMarkdown(channelId.trim(), limit);
      setExportMd(r.markdown ?? "*No content*");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setExportLoading(false);
    }
  };

  const load = () => {
    if (!channelId.trim()) return;
    setLoading(true);
    setErr(null);
    api
      .getChannelMessages(channelId.trim(), limit)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  const messages = data?.messages ?? [];

  const loadThreads = () => {
    if (!channelId.trim()) return;
    setThreadsLoading(true);
    api
      .getChannelThreads(channelId.trim())
      .then((r) => setThreads(r.threads ?? []))
      .catch(() => setThreads([]))
      .finally(() => setThreadsLoading(false));
  };

  const openThread = (threadId: string) => {
    setChannelId(threadId);
    setThreadsOpen(false);
    setData(null);
    setErr(null);
    setLoading(true);
    api
      .getChannelMessages(threadId, limit)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  const handleDeleteMessage = async (m: Message) => {
    if (!channelId.trim()) return;
    if (!window.confirm(`Delete message from ${m.author}?`)) return;
    setModBusy(m.id);
    setErr(null);
    try {
      await api.deleteMessage(channelId.trim(), m.id);
      setData((prev) =>
        prev
          ? { ...prev, messages: (prev.messages ?? []).filter((x) => x.id !== m.id) }
          : prev,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setModBusy(null);
    }
  };

  const handleEditMessage = async (m: Message, content: string) => {
    if (!channelId.trim() || !content.trim()) return;
    setModBusy(m.id);
    setErr(null);
    try {
      await api.editMessage(channelId.trim(), m.id, content);
      setData((prev) =>
        prev
          ? {
              ...prev,
              messages: (prev.messages ?? []).map((x) =>
                x.id === m.id
                  ? { ...x, content, edited_timestamp: new Date().toISOString() }
                  : x,
              ),
            }
          : prev,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setModBusy(null);
    }
  };

  const loadPins = () => {
    if (!channelId.trim()) return;
    setPinsLoading(true);
    api
      .getPinnedMessages(channelId.trim())
      .then((r) => setPins(r.messages ?? []))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setPinsLoading(false));
  };

  const handlePinMessage = async (m: Message) => {
    if (!channelId.trim()) return;
    setModBusy(m.id);
    setErr(null);
    try {
      await api.pinMessage(channelId.trim(), m.id);
      setPins((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setModBusy(null);
    }
  };

  const handleUnpinMessage = async (m: Message) => {
    if (!channelId.trim()) return;
    setModBusy(m.id);
    setErr(null);
    try {
      await api.unpinMessage(channelId.trim(), m.id);
      setPins((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setModBusy(null);
    }
  };

  const handleExportCSV = () => {
    const rows = messages.map((m) => ({
      id: m.id,
      author: m.author,
      content: m.content,
    }));
    exportCSV(rows, `discord-messages-${channelId}.csv`);
  };
  const handleExportJSON = () => {
    exportJSON(
      { channel_id: channelId, messages, count: messages.length },
      `discord-messages-${channelId}.json`,
    );
  };

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <MessageSquare className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Messages
          </h1>
          <p className="text-slate-400 text-sm">
            Read recent messages from a channel — pick a server and channel below
          </p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}
      {channelsErr && (
        <p className="text-xs text-red-400">Channel list failed to load: {channelsErr}</p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {showPicker && (
          <select
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200 min-w-[180px]"
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
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200 min-w-[240px]"
        >
          <option value="">Select channel…</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <button
          type="button"
          onClick={load}
          disabled={!channelId.trim() || loading}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
        >
          {loading ? "Loading…" : "Load"}
        </button>
        <button
          type="button"
          onClick={() => {
            setThreadsOpen(!threadsOpen);
            if (!threadsOpen) loadThreads();
          }}
          disabled={!channelId.trim()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm"
        >
          <MessageCircle className="w-4 h-4" />
          Threads
        </button>
        <button
          type="button"
          onClick={() => {
            setPinsOpen(!pinsOpen);
            if (!pinsOpen) loadPins();
          }}
          disabled={!channelId.trim()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm"
        >
          <Pin className="w-4 h-4" />
          Pins{pins.length > 0 ? ` (${pins.length})` : ""}
        </button>
        {messages.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadExport}
              disabled={exportLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm"
            >
              <FileText className="w-4 h-4" /> {exportLoading ? "Exporting…" : "Markdown"}
            </button>
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
          </div>
        )}
      </div>

      {threadsOpen && channelId.trim() && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <span className="text-slate-400 text-sm">
              Active threads in channel
            </span>
            <button
              type="button"
              onClick={loadThreads}
              disabled={threadsLoading}
              className="text-indigo-400 hover:underline text-sm disabled:opacity-50"
            >
              {threadsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <ul className="p-4 max-h-48 overflow-y-auto space-y-2">
            {threads.length === 0 && !threadsLoading && (
              <li className="text-slate-500 text-sm">
                No active threads or not a text channel.
              </li>
            )}
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openThread(t.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-sm flex items-center justify-between"
                >
                  <span className="font-medium truncate">{t.name}</span>
                  <span className="text-slate-500 text-xs shrink-0 ml-2">
                    {t.message_count ?? 0} msgs
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pinsOpen && channelId.trim() && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <span className="text-slate-400 text-sm">
              Pinned messages in channel
            </span>
            <button
              type="button"
              onClick={loadPins}
              disabled={pinsLoading}
              className="text-indigo-400 hover:underline text-sm disabled:opacity-50"
            >
              {pinsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <ul className="p-4 max-h-64 overflow-y-auto space-y-2">
            {pins.length === 0 && !pinsLoading && (
              <li className="text-slate-500 text-sm">
                No pinned messages in this channel.
              </li>
            )}
            {pins.map((m) => (
              <li
                key={m.id}
                className="px-3 py-2 rounded-lg bg-white/5 text-sm flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-amber-400/90">{m.author}</span>
                  <p className="text-slate-300 break-words">
                    {(m.content || "").slice(0, 200) || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnpinMessage(m)}
                  disabled={modBusy === m.id}
                  className="text-xs text-slate-500 hover:text-red-300 shrink-0 disabled:opacity-40"
                >
                  {modBusy === m.id ? "…" : "Unpin"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {exportMd && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <span className="text-slate-400 text-sm">Markdown Export</span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(exportMd); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-300 text-xs"
            >
              <Clipboard className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="p-4 text-sm text-slate-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">{exportMd}</pre>
        </div>
      )}

      {data && !loading && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
          <div className="p-4 border-b border-white/10 text-slate-400 text-sm flex items-center justify-between flex-wrap gap-2">
            <span>{messages.length} message(s)</span>
          </div>
          <div className="p-4">
            <MessageViewer
              messages={messages}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              actions={{
                onDelete: handleDeleteMessage,
                onEdit: handleEditMessage,
                onPin: handlePinMessage,
                busyId: modBusy,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
