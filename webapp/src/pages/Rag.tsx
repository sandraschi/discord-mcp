import {
  AlertCircle,
  Archive,
  Brain,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FolderSync,
  HardDrive,
  Hash,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  api,
  type DepotInventoryItem,
  type RagHit,
  type RagStatsResponse,
  type RagSweepStatusResponse,
} from "../lib/api";
import { exportJSON } from "../lib/export";

export default function Rag() {
  // Stats state
  const [stats, setStats] = useState<RagStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Sweep parameters
  const [channelId, setChannelId] = useState("");
  const [guildId, setGuildId] = useState("");
  const [limit, setLimit] = useState(100);
  const [isSweeping, setIsSweeping] = useState(false);
  const [activeJob, setActiveJob] = useState<RagSweepStatusResponse | null>(null);

  // Depot state
  const [inventory, setInventory] = useState<DepotInventoryItem[]>([]);
  const [depotLoading, setDepotLoading] = useState(false);
  const [depotSyncing, setDepotSyncing] = useState(false);
  const [depotMessage, setDepotMessage] = useState<string | null>(null);

  // Query state
  const [queryText, setQueryText] = useState("");
  const [topK, setTopK] = useState(10);
  const [minScore, setMinScore] = useState(0.25);
  const [queryLoading, setQueryLoading] = useState(false);
  const [hits, setHits] = useState<RagHit[]>([]);
  const [queryErr, setQueryErr] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const pollIntervalRef = useRef<any>(null);

  const loadStats = () => {
    setStatsLoading(true);
    api
      .getRagStats()
      .then((r) => {
        if (r.success) setStats(r);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  };

  const loadDepot = () => {
    setDepotLoading(true);
    api
      .getDepotInventory()
      .then((r) => {
        if (r.success && r.inventory) setInventory(r.inventory);
      })
      .catch(() => {})
      .finally(() => setDepotLoading(false));
  };

  useEffect(() => {
    loadStats();
    loadDepot();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const triggerSweep = async (fullReindex: boolean) => {
    if (!channelId.trim() && !guildId.trim()) return;
    setIsSweeping(true);
    setActiveJob(null);
    try {
      const res = await api.triggerRagSweep({
        channel_id: channelId.trim() || undefined,
        guild_id: guildId.trim() || undefined,
        limit,
        full_reindex: fullReindex,
      });

      if (!res.success || !res.job_id) {
        setIsSweeping(false);
        return;
      }

      pollJob(res.job_id);
    } catch {
      setIsSweeping(false);
    }
  };

  const pollJob = (jobId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const job = await api.getRagStatus(jobId);
        setActiveJob(job);

        if (job.status === "complete" || job.status === "error") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsSweeping(false);
          loadStats();
          loadDepot();
        }
      } catch {
        // network retry
      }
    }, 1000);
  };

  const handleSyncDepotOnly = async () => {
    if (!channelId.trim()) return;
    setDepotSyncing(true);
    setDepotMessage(null);
    try {
      const res = await api.syncDepot({
        channel_id: channelId.trim(),
        guild_id: guildId.trim() || "dm",
        limit,
      });
      if (res.success) {
        setDepotMessage(`Archived ${res.appended} new messages (total in depot: ${res.total}).`);
        loadDepot();
      } else {
        setDepotMessage(`Depot sync failed: ${res.error || "unknown"}`);
      }
    } catch (e: any) {
      setDepotMessage(`Depot sync failed: ${e.message}`);
    } finally {
      setDepotSyncing(false);
    }
  };

  const handleQuery = () => {
    if (!queryText.trim()) return;
    setQueryLoading(true);
    setQueryErr(null);
    setSearched(true);
    setHits([]);
    api
      .ragQuery({
        query_text: queryText.trim(),
        top_k: topK,
        channel_id: channelId.trim() || undefined,
        guild_id: guildId.trim() || undefined,
      })
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
          <Brain className="text-indigo-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Discord RAG Operations & Guild Depot
            </h1>
            <p className="text-slate-400 text-sm">
              Local LanceDB vector repository, selective channel depot archiving, and FastEmbed semantic search
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            loadStats();
            loadDepot();
          }}
          disabled={statsLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs disabled:opacity-50 transition-colors border border-white/5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? "animate-spin" : ""}`} />
          Refresh Telemetry
        </button>
      </div>

      {/* RAG Telemetry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Total Chunks
            </span>
            <p className="text-xl font-bold text-white">
              {(stats?.total_chunks ?? 0).toLocaleString()}
            </p>
            <span className="text-[10px] text-slate-400">LanceDB vectors</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Embedding Model
            </span>
            <p className="text-sm font-bold text-white truncate max-w-[140px]">
              {stats?.embedding_model?.split("/").pop() ?? "all-MiniLM-L6-v2"}
            </p>
            <span className="text-[10px] text-slate-400">384-dim normalized</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Accelerator
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${stats?.gpu_accelerated ? "bg-emerald-400" : "bg-blue-400"}`}
              />
              <span className="text-sm font-bold text-white">
                {stats?.gpu_accelerated ? "CUDA (GPU)" : "CPU"}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {stats?.gpu_accelerated ? "Hardware accelerated" : "ONNX/Torch fallback"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Storage Footprint
            </span>
            <p className="text-xl font-bold text-white">{stats?.storage_mb ?? 0} MB</p>
            <span className="text-[10px] text-slate-400">On-disk LanceDB</span>
          </div>
        </div>
      </div>

      {/* Index Synchronization & Sweep Control Plane */}
      <section className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-white border-b border-white/5 pb-2 flex items-center gap-2">
          <FolderSync className="w-4 h-4 text-indigo-400" />
          Index Synchronization & Sweeps
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-500 text-xs mb-1">
              Channel ID (Target single channel)
            </label>
            <input
              type="text"
              placeholder="e.g. 11576298103"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2 text-slate-200 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">
              Guild ID (Optional, sweep whole guild)
            </label>
            <input
              type="text"
              placeholder="e.g. 9876543210"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2 text-slate-200 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Max Messages Per Channel</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2 text-slate-200 text-sm"
            >
              <option value={25}>25 messages</option>
              <option value={50}>50 messages</option>
              <option value={100}>100 messages</option>
              <option value={250}>250 messages</option>
              <option value={500}>500 messages</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => triggerSweep(false)}
            disabled={(!channelId.trim() && !guildId.trim()) || isSweeping}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            {isSweeping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Incremental Sweep (New Chunks Only)
          </button>

          <button
            type="button"
            onClick={() => triggerSweep(true)}
            disabled={(!channelId.trim() && !guildId.trim()) || isSweeping}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/5 disabled:opacity-50 text-slate-200 text-sm font-semibold cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Full Rebuild (Wipe & Re-embed)
          </button>

          <button
            type="button"
            onClick={handleSyncDepotOnly}
            disabled={!channelId.trim() || depotSyncing || isSweeping}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 text-sm font-medium cursor-pointer ml-auto"
          >
            <Archive className="w-4 h-4" />
            {depotSyncing ? "Archiving..." : "Archive to Depot (JSONL)"}
          </button>
        </div>

        {depotMessage && (
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300">
            {depotMessage}
          </div>
        )}

        {/* Active Job Terminal & Running Progress */}
        {activeJob && (
          <div className="mt-4 p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeJob.status === "running" && (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                )}
                {activeJob.status === "complete" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                {activeJob.status === "error" && (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-sm font-semibold text-white capitalize">
                  {activeJob.phase}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  T+{activeJob.elapsed_seconds}s
                </span>
                <span className="text-slate-600">|</span>
                <span>Job: {activeJob.job_id.slice(0, 8)}</span>
              </div>
            </div>

            {activeJob.total > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Processing channels...</span>
                  <span>
                    {activeJob.current} / {activeJob.total} (
                    {Math.round((activeJob.current / activeJob.total) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((activeJob.current / activeJob.total) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>
                Indexed: <strong className="text-white">{activeJob.chunks} chunks</strong>{" "}
                (Skipped: <strong className="text-white">{activeJob.skipped}</strong> existing)
              </span>
              {activeJob.message && (
                <span className="text-slate-300">{activeJob.message}</span>
              )}
              {activeJob.error && (
                <span className="text-red-400 font-medium">{activeJob.error}</span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Local Guild & Channel Depot Inventory */}
      <section className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            Local Channel Depot Archives
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {inventory.length} cached channel(s)
          </span>
        </div>

        {depotLoading && (
          <div className="py-4 text-center text-xs text-slate-500">
            Loading depot inventory...
          </div>
        )}

        {!depotLoading && inventory.length === 0 && (
          <p className="text-xs text-slate-500 italic py-2">
            No channel archives in local depot yet. Use "Archive to Depot" or run an Incremental Sweep above.
          </p>
        )}

        {inventory.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
            {inventory.map((item) => (
              <div
                key={`${item.guild_id}-${item.channel_id}`}
                className="p-3 rounded-xl border border-white/5 bg-black/40 hover:bg-black/60 transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-white">
                    <Hash className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">{item.channel_name || item.channel_id}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Guild: {item.guild_name || item.guild_id} · {item.size_kb} KB
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-mono text-[10px]">
                    {item.message_count} msgs
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setChannelId(item.channel_id);
                      setGuildId(item.guild_id);
                    }}
                    className="block text-[10px] text-indigo-400 hover:text-indigo-300 mt-1"
                  >
                    Select →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Semantic Search Console */}
      <section className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-400" />
            Neural Semantic Retrieval Console
          </h2>
          {hits.length > 0 && (
            <button
              type="button"
              onClick={exportHits}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Natural-language questions, topics, or bug reports across Discord chats..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2 text-slate-200 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Results:</span>
            <select
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value) || 10)}
              className="rounded-xl bg-black/50 border border-white/10 px-2 py-2 text-slate-200 text-xs"
            >
              <option value={5}>5 hits</option>
              <option value={10}>10 hits</option>
              <option value={25}>25 hits</option>
              <option value={50}>50 hits</option>
            </select>
            <span className="text-xs text-slate-500 whitespace-nowrap">Min Score:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="rounded-xl bg-black/50 border border-white/10 px-2 py-2 text-slate-200 text-xs"
            >
              <option value={0.20}>0.20 (Broad)</option>
              <option value={0.25}>0.25 (Default)</option>
              <option value={0.35}>0.35 (Strict)</option>
              <option value={0.50}>0.50 (Exact)</option>
            </select>
            <button
              type="button"
              onClick={handleQuery}
              disabled={!queryText.trim() || queryLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer shrink-0"
            >
              {queryLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Neural Match
            </button>
          </div>
        </div>

        {queryErr && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {queryErr}
          </div>
        )}

        {searched && !queryLoading && hits.length === 0 && (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            No vector passages met the relevance threshold for "{queryText}". Try running an Incremental Sweep on your channels.
          </p>
        )}

        {hits.length > 0 && (
          <div className="space-y-3 pt-2">
            {hits.map((h, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-white/5 bg-black/40 hover:bg-black/60 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="font-semibold text-white">@{h.author || "Unknown"}</span>
                    <span>·</span>
                    <span className="text-indigo-400">#{h.channel_name || h.channel_id || "general"}</span>
                    {h.guild_name && (
                      <>
                        <span>·</span>
                        <span className="text-slate-500">{h.guild_name}</span>
                      </>
                    )}
                    {h.timestamp && (
                      <>
                        <span>·</span>
                        <span className="text-slate-500">{h.timestamp}</span>
                      </>
                    )}
                  </div>
                  {h.score !== undefined ? (
                    <span className="px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800 font-mono text-[10px]">
                      score: {h.score.toFixed(3)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono">
                      dist: {(h.distance ?? 0).toFixed(3)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 bg-black/30 p-2.5 rounded-lg border border-white/5 leading-relaxed">
                  {h.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
