import { useEffect, useState } from 'react'
import { Server, AlertCircle, Download, Star } from 'lucide-react'
import { api, type GuildsResponse } from '../lib/api'
import { exportCSV, exportJSON } from '../lib/export'
import { getFavorites, addGuild, removeGuild } from '../lib/favorites'

export default function Guilds() {
  const [data, setData] = useState<GuildsResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavorites().guilds.map((g) => g.id)))

  useEffect(() => {
    api.getGuilds().then(setData).catch((e) => setErr(e.message))
  }, [])

  const toggleFavorite = (g: { id: string; name: string }) => {
    if (favoriteIds.has(g.id)) {
      removeGuild(g.id)
    } else {
      addGuild({ id: g.id, name: g.name })
    }
    setFavoriteIds(new Set(getFavorites().guilds.map((x) => x.id)))
  }

  if (err) {
    return (
      <div className="space-y-6 py-4 max-w-4xl">
        <h1 className="text-2xl font-bold text-white">Guilds</h1>
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      </div>
    )
  }

  const guilds = data?.guilds ?? []

  const handleExportCSV = () => {
    exportCSV(
      guilds.map((g) => ({ id: g.id, name: g.name, owner: g.owner ?? false })),
      'discord-guilds.csv'
    )
  }
  const handleExportJSON = () => {
    exportJSON({ guilds, count: guilds.length }, 'discord-guilds.json')
  }

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Server className="text-indigo-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Guilds</h1>
            <p className="text-slate-400 text-sm">Servers the bot is in ({guilds.length})</p>
          </div>
        </div>
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
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-4 w-10 text-sm font-bold text-slate-300"></th>
              <th className="p-4 text-sm font-bold text-slate-300">Name</th>
              <th className="p-4 text-sm font-bold text-slate-300">ID</th>
              <th className="p-4 text-sm font-bold text-slate-300">Owner</th>
            </tr>
          </thead>
          <tbody>
            {guilds.map((g) => (
              <tr key={g.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(g)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-white/10 hover:text-amber-400"
                    title={favoriteIds.has(g.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star
                      className="w-4 h-4"
                      fill={favoriteIds.has(g.id) ? 'currentColor' : 'none'}
                    />
                  </button>
                </td>
                <td className="p-4 font-medium text-slate-200">{g.name}</td>
                <td className="p-4 text-slate-400 font-mono text-sm">{g.id}</td>
                <td className="p-4">{g.owner ? <span className="text-amber-400">Yes</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
