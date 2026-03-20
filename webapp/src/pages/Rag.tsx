import { useState } from 'react'
import { Database, AlertCircle, Download } from 'lucide-react'
import { api, type RagHit } from '../lib/api'
import { exportJSON } from '../lib/export'

export default function Rag() {
  const [channelId, setChannelId] = useState('')
  const [guildName, setGuildName] = useState('')
  const [channelName, setChannelName] = useState('')
  const [limit, setLimit] = useState(50)
  const [ingestLoading, setIngestLoading] = useState(false)
  const [ingestResult, setIngestResult] = useState<{ ingested: number; err?: string } | null>(null)

  const [queryText, setQueryText] = useState('')
  const [topK, setTopK] = useState(10)
  const [queryLoading, setQueryLoading] = useState(false)
  const [hits, setHits] = useState<RagHit[]>([])
  const [queryErr, setQueryErr] = useState<string | null>(null)

  const handleIngest = () => {
    if (!channelId.trim()) return
    setIngestLoading(true)
    setIngestResult(null)
    api
      .ragIngest({
        channel_id: channelId.trim(),
        limit,
        guild_name: guildName.trim(),
        channel_name: channelName.trim(),
      })
      .then((r) => setIngestResult({ ingested: r.ingested ?? 0 }))
      .catch((e) => setIngestResult({ ingested: 0, err: e.message }))
      .finally(() => setIngestLoading(false))
  }

  const handleQuery = () => {
    if (!queryText.trim()) return
    setQueryLoading(true)
    setQueryErr(null)
    setHits([])
    api
      .ragQuery({ query_text: queryText.trim(), top_k: topK })
      .then((r) => setHits(r.hits ?? []))
      .catch((e) => setQueryErr(e.message))
      .finally(() => setQueryLoading(false))
  }

  const exportHits = () => {
    exportJSON({ query: queryText, top_k: topK, hits }, 'discord-rag-hits.json')
  }

  return (
    <div className="space-y-8 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Database className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">RAG (LanceDB)</h1>
          <p className="text-slate-400 text-sm">
            Ingest channel messages into LanceDB, then semantic search.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Ingest channel</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-slate-500 text-xs mb-1">Channel ID</label>
            <input
              type="text"
              placeholder="Channel ID"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200 min-w-[220px] font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Guild name (optional)</label>
            <input
              type="text"
              placeholder="Server name"
              value={guildName}
              onChange={(e) => setGuildName(e.target.value)}
              className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200 min-w-[160px]"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Channel name (optional)</label>
            <input
              type="text"
              placeholder="Channel name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200 min-w-[160px]"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleIngest}
            disabled={!channelId.trim() || ingestLoading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
          >
            {ingestLoading ? 'Ingesting…' : 'Ingest'}
          </button>
        </div>
        {ingestResult !== null && (
          <div
            className={
              ingestResult.err
                ? 'flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-sm'
                : 'text-slate-400 text-sm'
            }
          >
            {ingestResult.err ? (
              <>
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {ingestResult.err}
              </>
            ) : (
              <>Ingested {ingestResult.ingested} message(s) into LanceDB.</>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Semantic search</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-slate-500 text-xs mb-1">Query</label>
            <input
              type="text"
              placeholder="Search ingested Discord messages…"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              className="w-full rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Top K</label>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleQuery}
            disabled={!queryText.trim() || queryLoading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
          >
            {queryLoading ? 'Searching…' : 'Search'}
          </button>
          {hits.length > 0 && (
            <button
              type="button"
              onClick={exportHits}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm"
            >
              <Download className="w-4 h-4" /> Export JSON
            </button>
          )}
        </div>
        {queryErr && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {queryErr}
          </div>
        )}
        {hits.length > 0 && (
          <ul className="space-y-3 max-h-[50vh] overflow-y-auto">
            {hits.map((h, i) => (
              <li
                key={i}
                className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
              >
                <div className="flex flex-wrap gap-2 text-slate-500 text-xs mb-1">
                  {h.guild_name && <span>{h.guild_name}</span>}
                  {h.channel_name && <span>#{h.channel_name}</span>}
                  {h.author && <span>{h.author}</span>}
                  {h.timestamp && <span>{h.timestamp}</span>}
                </div>
                <p className="text-slate-200 text-sm break-words">{h.text ?? ''}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
