import { AlertCircle, Database, Download, RefreshCw, Layers, Clock, Search, Inbox, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type RagHit, type RagStatsTable } from "../lib/api";
import { exportJSON } from "../lib/export";

export default function Rag() {
  // Stats state
  const [stats, setStats] = useState<RagStatsTable[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Ingest state
  const [channelId, setChannelId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [channelName, setChannelName] = useState("");
  const [limit, setLimit] = useState(50);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState<{
    ingested: number;
    err?: string;
  } | null>(null);

  // Query state
  const [queryText, setQueryText] = useState("");
  const [topK, setTopK] = useState(10);
  const [queryLoading, setQueryLoading] = useState(false);
  const [hits, setHits] = useState<RagHit[]>([]);
  const [queryErr, setQueryErr] = useState<string | null>(null);

  const loadStats = () => {
    setStatsLoading(true);
    api
      .getRagStats()
      .then((r) => {
        if (r.success && r.tables) setStats(r.tables);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleIngest = () => {
    if (!channelId.trim()) return;
    setIngestLoading(true);
    setIngestResult(null);
    api
      .ragIngest({
        channel_id: channelId.trim(),
        limit,
        guild_name: guildName.trim(),
        channel_name: channelName.trim(),
      })
      .then((r) => {
        setIngestResult({ ingested: r.ingested ?? 0 });
        loadStats();
      })
      .catch((e) => setIngestResult({ ingested: 0, err: e.message }))
      .finally(() => setIngestLoading(false));
  };

  const handleSync = () => {
    if (!channelId.trim()) return;
    setIngestLoading(true);
    setIngestResult(null);
    api
      .ragSync({
        channel_id: channelId.trim(),
        limit,
        guild_name: guildName.trim(),
        channel_name: channelName.trim(),
      })
      .then((r) => {
        setIngestResult({ ingested: r.ingested ?? 0 });
        loadStats();
      })
      .catch((e) => setIngestResult({ ingested: 0, err: e.message }))
      .finally(() => setIngestLoading(false));
  };

  const handleQuery = () => {
    if (!queryText.trim()) return;
    setQueryLoading(true);
    setQueryErr(null);
    setHits([]);
    api
      .ragQuery({ query_text: queryText.trim(), top_k: topK })
      .then((r) => setHits(r.hits ?? []))
      .catch((e) => setQueryErr(e.message))
      .finally(() => setQueryLoading(false));
  };

  const exportHits = () => {
    exportJSON(
      { query: queryText, top_k: topK, hits },
      "discord-rag-hits.json",
    );
  };

  return (
    <div className="space-y-8 py-4 max-w-5xl" data-testid="rag-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Database className="text-indigo-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              RAG Knowledge Base
            </h1>
            <p className="text-slate-400 text-sm">
              Vector database indexing and semantic search powered by LanceDB
            </p>
          </div>
        </div>
        <button
          onClick={loadStats}
          disabled={statsLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs disabled:opacity-50 transition-colors border border-white/5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? "animate-spin" : ""}`} />
          Refresh Stats
        </button>
      </div>

      {/* RAG Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Active Tables</span>
            <p className="text-lg font-bold text-white">{stats.length}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Chunks</span>
            <p className="text-lg font-bold text-white">
              {stats.reduce((acc, t) => acc + t.count, 0)} Chunks
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Auto-Sync Ingestion</span>
            <p className="text-sm font-semibold text-slate-300">Available (Gateway mode)</p>
          </div>
        </div>
      </div>

      {/* Ingestion & Sync controls */}
      <section className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-white border-b border-white/5 pb-2">Sync & Ingest Channels</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-slate-500 text-xs mb-1">Channel ID</label>
            <input
              type="text"
              placeholder="e.g. 11576298103"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2 text-slate-200 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Server Name (optional)</label>
            <input
              type="text"
              placeholder="Server name"
              value={guildName}
              onChange={(e) => setGuildName(e.target.value)}
              className="rounded-xl bg-black/50 border border-white/10 px-4 py-2 text-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Channel Name (optional)</label>
            <input
              type="text"
              placeholder="Channel name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="rounded-xl bg-black/50 border border-white/10 px-4 py-2 text-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Max Messages</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-xl bg-black/50 border border-white/10 px-4 py-2 text-slate-200 text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleIngest}
              disabled={!channelId.trim() || ingestLoading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/5 disabled:opacity-50 text-slate-200 text-sm font-semibold"
            >
              {ingestLoading ? "Ingesting…" : "Raw Ingest"}
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={!channelId.trim() || ingestLoading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-indigo-600/10"
            >
              {ingestLoading ? "Syncing…" : "Background Sync"}
            </button>
          </div>
        </div>
        
        {ingestResult !== null && (
          <div
            className={
              ingestResult.err
                ? "flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-sm"
                : "p-3 bg-emerald-500/10 text-emerald-300 rounded-xl text-xs border border-emerald-500/20 font-medium"
            }
          >
            {ingestResult.err ? (
              <>
                <AlertCircle className="w-4 h-4 shrink-0" />
                {ingestResult.err}
              </>
            ) : (
              <>Ingested & Embedded {ingestResult.ingested} message(s) into LanceDB database.</>
            )}
          </div>
        )}
      </section>

      {/* Semantic Search */}
      <section className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-white border-b border-white/5 pb-2">Semantic Search</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px] relative">
            <label className="block text-slate-500 text-xs mb-1">Semantic Query</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Ask your knowledge base (e.g. what did we decide about the timeline?)"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                className="w-full rounded-xl bg-black/50 border border-white/10 pl-9 pr-4 py-2 text-slate-200 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Limit Results</label>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="rounded-xl bg-black/50 border border-white/10 px-4 py-2 text-slate-200 text-sm"
            >
              <option value={5}>5 Results</option>
              <option value={10}>10 Results</option>
              <option value={20}>20 Results</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleQuery}
            disabled={!queryText.trim() || queryLoading}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-indigo-600/10"
          >
            {queryLoading ? "Searching…" : "Search"}
          </button>
          {hits.length > 0 && (
            <button
              type="button"
              onClick={exportHits}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>
          )}
        </div>

        {queryErr && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {queryErr}
          </div>
        )}

        {hits.length > 0 ? (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
            {hits.map((h, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-black/30 transition-colors flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2 text-slate-400">
                    {h.guild_name && <span className="font-semibold text-indigo-400">{h.guild_name}</span>}
                    {h.channel_name && <span className="text-slate-500">#{h.channel_name}</span>}
                    {h.author && <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">@{h.author}</span>}
                  </div>
                  {h.timestamp && <span className="text-slate-600">{new Date(h.timestamp).toLocaleString()}</span>}
                </div>
                <p className="text-slate-300 text-xs leading-relaxed font-sans">{h.text}</p>
                <div className="text-[10px] text-slate-600 flex justify-between">
                  <span>ID: {h.message_id}</span>
                  <span>Distance: {h.distance?.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : queryText.trim() && !queryLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-sm">
            <Inbox className="w-8 h-8 mb-2 opacity-40" />
            No matches found for "{queryText}"
          </div>
        ) : null}
      </section>
    </div>
  );
}
