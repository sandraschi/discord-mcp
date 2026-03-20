import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Hash, AlertCircle, Download, RefreshCw, Star } from 'lucide-react'
import { api, type Guild, type GuildsResponse, type ChannelsResponse, type Channel } from '../lib/api'
import { exportCSV, exportJSON } from '../lib/export'
import { getFavorites, addChannel, removeChannel } from '../lib/favorites'

const CHANNEL_TYPE_NAMES: Record<number, string> = {
  0: 'Text',
  2: 'Voice',
  4: 'Category',
  5: 'Announcement',
}

export default function Channels() {
  const location = useLocation()
  const stateGuildId = (location.state as { guildId?: string } | null)?.guildId
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedGuildId, setSelectedGuildId] = useState<string>(stateGuildId ?? '')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [favoriteChannelIds, setFavoriteChannelIds] = useState<Set<string>>(
    () => new Set(getFavorites().channels.map((c) => c.id))
  )

  useEffect(() => {
    api.getGuilds().then((r: GuildsResponse) => setGuilds(r.guilds ?? [])).catch((e) => setErr(e.message))
  }, [])
  useEffect(() => {
    if (stateGuildId) setSelectedGuildId(stateGuildId)
  }, [stateGuildId])

  useEffect(() => {
    if (!selectedGuildId) {
      setChannels([])
      return
    }
    setLoading(true)
    setErr(null)
    api
      .getChannels(selectedGuildId)
      .then((r: ChannelsResponse) => setChannels(r.channels ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [selectedGuildId])

  const handleExportCSV = () => {
    const rows = channels.map((c) => ({
      id: c.id,
      name: c.name,
      type: CHANNEL_TYPE_NAMES[c.type] ?? c.type,
      guild_id: selectedGuildId,
    }))
    exportCSV(rows, `discord-channels-${selectedGuildId}.csv`)
  }
  const handleExportJSON = () => {
    exportJSON({ guild_id: selectedGuildId, channels, count: channels.length }, `discord-channels-${selectedGuildId}.json`)
  }

  const guildName = guilds.find((g) => g.id === selectedGuildId)?.name ?? ''
  const toggleChannelFavorite = (c: Channel) => {
    if (favoriteChannelIds.has(c.id)) {
      removeChannel(c.id)
    } else {
      addChannel({ id: c.id, guildId: selectedGuildId, name: c.name, guildName })
    }
    setFavoriteChannelIds(new Set(getFavorites().channels.map((x) => x.id)))
  }

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Hash className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Channels</h1>
          <p className="text-slate-400 text-sm">List channels by guild</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="text-slate-300 text-sm font-medium">Guild</label>
        <select
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
          </div>
        )}
      </div>

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
                <th className="p-4 text-sm font-bold text-slate-300">ID</th>
                <th className="p-4 text-sm font-bold text-slate-300">Type</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => toggleChannelFavorite(c)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-white/10 hover:text-amber-400"
                      title={favoriteChannelIds.has(c.id) ? 'Remove from favorites' : 'Add to favorites (for Trawl)'}
                    >
                      <Star className="w-4 h-4" fill={favoriteChannelIds.has(c.id) ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td className="p-4 font-medium text-slate-200">{c.name}</td>
                  <td className="p-4 text-slate-400 font-mono text-sm">{c.id}</td>
                  <td className="p-4 text-slate-400">{CHANNEL_TYPE_NAMES[c.type] ?? c.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {channels.length === 0 && (
            <p className="p-6 text-slate-500 text-center">No channels or no permission.</p>
          )}
        </div>
      )}
    </div>
  )
}
