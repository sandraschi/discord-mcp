import { useState } from 'react'
import { Search, AlertCircle, Download, RefreshCw } from 'lucide-react'
import { getFavorites } from '../lib/favorites'
import { api, type MessagesResponse } from '../lib/api'
import { exportCSV, exportJSON } from '../lib/export'

interface TrawlMessage {
  channelId: string
  channelName: string
  guildName: string
  author: string
  content: string
  id: string
}

export default function Trawl() {
  const [keyword, setKeyword] = useState('')
  const [messages, setMessages] = useState<TrawlMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [perChannelLimit] = useState(25)

  const favorites = getFavorites()
  const channels = favorites.channels

  const runTrawl = async () => {
    if (channels.length === 0) {
      setErr('Add favorite channels first (Channels page, star icon).')
      return
    }
    setLoading(true)
    setErr(null)
    setMessages([])
    const collected: TrawlMessage[] = []
    const kw = keyword.trim().toLowerCase()
    try {
      for (const ch of channels) {
        try {
          const r: MessagesResponse = await api.getChannelMessages(ch.id, perChannelLimit)
          const list = r.messages ?? []
          for (const m of list) {
            const content = (m.content ?? '').toLowerCase()
            if (!kw || content.includes(kw)) {
              collected.push({
                channelId: ch.id,
                channelName: ch.name,
                guildName: ch.guildName,
                author: m.author ?? '',
                content: m.content ?? '',
                id: m.id,
              })
            }
          }
        } catch (e) {
          collected.push({
            channelId: ch.id,
            channelName: ch.name,
            guildName: ch.guildName,
            author: '',
            content: `Error: ${e instanceof Error ? e.message : String(e)}`,
            id: `err-${ch.id}`,
          })
        }
      }
      setMessages(collected)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    const rows = messages.map((m) => ({
      guild: m.guildName,
      channel: m.channelName,
      channel_id: m.channelId,
      author: m.author,
      content: m.content,
    }))
    exportCSV(rows, `discord-trawl${keyword ? `-${keyword}` : ''}.csv`)
  }
  const handleExportJSON = () => {
    exportJSON(
      { keyword: keyword || null, channels_trawled: channels.length, messages },
      `discord-trawl${keyword ? `-${keyword}` : ''}.json`
    )
  }

  return (
    <div className="space-y-6 py-4 max-w-6xl">
      <div className="flex items-center gap-4">
        <Search className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Trawl</h1>
          <p className="text-slate-400 text-sm">
            Fetch recent messages from favorite channels (e.g. LM Studio release announcements)
          </p>
        </div>
      </div>

      {channels.length === 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200 text-sm">
          Add favorite channels on the Channels page (star icon). Then run trawl here to scan for keywords like
          &quot;release&quot; or &quot;announcement&quot;.
        </div>
      )}

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Filter by keyword (e.g. release, announcement)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200 min-w-[240px]"
        />
        <button
          type="button"
          onClick={runTrawl}
          disabled={loading || channels.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {loading ? 'Trawling…' : 'Trawl favorites'}
        </button>
        {messages.length > 0 && (
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
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
          <div className="p-4 border-b border-white/10 text-slate-400 text-sm">
            {messages.length} message(s) from {channels.length} channel(s)
            {keyword && ` matching "${keyword}"`}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#0f0f12] border-b border-white/10">
                <tr>
                  <th className="p-3 text-sm font-bold text-slate-300">Server / Channel</th>
                  <th className="p-3 text-sm font-bold text-slate-300">Author</th>
                  <th className="p-3 text-sm font-bold text-slate-300">Content</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 text-slate-400 text-sm">
                      <span className="text-slate-500">{m.guildName}</span>
                      <span className="mx-1">/</span>
                      <span className="text-indigo-400/90">#{m.channelName}</span>
                    </td>
                    <td className="p-3 text-amber-400/90 font-medium">{m.author}</td>
                    <td className="p-3 text-slate-300 text-sm break-words max-w-md">{m.content || '(empty)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
