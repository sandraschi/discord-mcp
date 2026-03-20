import { useEffect, useState } from 'react'
import { Users, AlertCircle, Download } from 'lucide-react'
import { api, type Guild, type GuildsResponse, type MembersResponse, type Member } from '../lib/api'
import { exportCSV, exportJSON } from '../lib/export'

export default function Members() {
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selectedGuildId, setSelectedGuildId] = useState<string>('')
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.getGuilds().then((r: GuildsResponse) => setGuilds(r.guilds ?? [])).catch((e) => setErr(e.message))
  }, [])

  useEffect(() => {
    if (!selectedGuildId) {
      setMembers([])
      return
    }
    setLoading(true)
    setErr(null)
    api
      .getMembers(selectedGuildId, limit)
      .then((r: MembersResponse) => setMembers(r.members ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [selectedGuildId, limit])

  const handleExportCSV = () => {
    const rows = members.map((m) => ({
      user_id: m.user_id,
      username: m.username ?? '',
      nick: m.nick ?? '',
      roles: (m.roles ?? []).join(';'),
      joined_at: m.joined_at ?? '',
    }))
    exportCSV(rows, `discord-members-${selectedGuildId}.csv`)
  }
  const handleExportJSON = () => {
    exportJSON(
      { guild_id: selectedGuildId, members, count: members.length },
      `discord-members-${selectedGuildId}.json`
    )
  }

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Users className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Members</h1>
          <p className="text-slate-400 text-sm">List members (GUILD_MEMBERS intent required)</p>
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
        <label className="text-slate-300 text-sm font-medium">Limit</label>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200"
        >
          <option value={100}>100</option>
          <option value={250}>250</option>
          <option value={500}>500</option>
          <option value={1000}>1000</option>
        </select>
        {selectedGuildId && members.length > 0 && (
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

      {loading && <p className="text-slate-400">Loading members…</p>}

      {selectedGuildId && !loading && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 text-sm font-bold text-slate-300">Username</th>
                <th className="p-4 text-sm font-bold text-slate-300">Nick</th>
                <th className="p-4 text-sm font-bold text-slate-300">User ID</th>
                <th className="p-4 text-sm font-bold text-slate-300">Joined</th>
                <th className="p-4 text-sm font-bold text-slate-300">Roles</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4 font-medium text-slate-200">{m.username ?? '—'}</td>
                  <td className="p-4 text-slate-400">{m.nick ?? '—'}</td>
                  <td className="p-4 font-mono text-sm text-slate-400">{m.user_id}</td>
                  <td className="p-4 text-slate-400 text-sm">{m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}</td>
                  <td className="p-4 text-slate-400 text-sm">{(m.roles ?? []).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 && (
            <p className="p-6 text-slate-500 text-center">No members or enable GUILD_MEMBERS intent.</p>
          )}
        </div>
      )}
    </div>
  )
}
