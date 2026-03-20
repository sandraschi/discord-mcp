import { useEffect, useState } from 'react'
import { Link2, AlertCircle, Download } from 'lucide-react'
import { api, type Guild, type GuildsResponse, type InvitesResponse, type Invite } from '../lib/api'
import { exportCSV, exportJSON } from '../lib/export'

export default function Invites() {
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [selectedGuildId, setSelectedGuildId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.getGuilds().then((r: GuildsResponse) => setGuilds(r.guilds ?? [])).catch((e) => setErr(e.message))
  }, [])

  useEffect(() => {
    if (!selectedGuildId) {
      setInvites([])
      return
    }
    setLoading(true)
    setErr(null)
    api
      .getInvites(selectedGuildId)
      .then((r: InvitesResponse) => setInvites(r.invites ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [selectedGuildId])

  const handleExportCSV = () => {
    const rows = invites.map((i) => ({
      code: i.code,
      url: i.url,
      uses: i.uses ?? '',
      max_uses: i.max_uses ?? '',
      inviter: i.inviter ?? '',
    }))
    exportCSV(rows, `discord-invites-${selectedGuildId}.csv`)
  }
  const handleExportJSON = () => {
    exportJSON({ guild_id: selectedGuildId, invites, count: invites.length }, `discord-invites-${selectedGuildId}.json`)
  }

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link2 className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Invites</h1>
          <p className="text-slate-400 text-sm">List and export invite links by guild</p>
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
        {selectedGuildId && invites.length > 0 && (
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

      {loading && <p className="text-slate-400">Loading invites…</p>}

      {selectedGuildId && !loading && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 text-sm font-bold text-slate-300">Code</th>
                <th className="p-4 text-sm font-bold text-slate-300">URL</th>
                <th className="p-4 text-sm font-bold text-slate-300">Uses</th>
                <th className="p-4 text-sm font-bold text-slate-300">Inviter</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.code} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4 font-mono text-sm text-slate-300">{i.code}</td>
                  <td className="p-4">
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline truncate max-w-[200px] block"
                    >
                      {i.url}
                    </a>
                  </td>
                  <td className="p-4 text-slate-400">
                    {i.uses ?? 0} / {i.max_uses ?? '∞'}
                  </td>
                  <td className="p-4 text-slate-400">{i.inviter ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {invites.length === 0 && (
            <p className="p-6 text-slate-500 text-center">No invites or no permission (Manage Server).</p>
          )}
        </div>
      )}
    </div>
  )
}
