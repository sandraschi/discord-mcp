import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { BarChart3, AlertCircle, Download, RefreshCw } from 'lucide-react'
import { api, type GuildsResponse, type GuildStats } from '../lib/api'
import { exportCSV, exportJSON } from '../lib/export'

interface GuildStatRow {
  guild_id: string
  name: string
  member_count: number
  online_count: number
}

export default function Stats() {
  const [rows, setRows] = useState<GuildStatRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const loadStats = async () => {
    setLoading(true)
    setErr(null)
    try {
      const guildsRes: GuildsResponse = await api.getGuilds()
      const guilds = guildsRes.guilds ?? []
      const next: GuildStatRow[] = []
      for (const g of guilds) {
        try {
          const s: GuildStats = await api.getGuildStats(g.id)
          next.push({
            guild_id: g.id,
            name: s.name ?? g.name,
            member_count: s.member_count ?? 0,
            online_count: s.online_count ?? 0,
          })
        } catch {
          next.push({ guild_id: g.id, name: g.name, member_count: 0, online_count: 0 })
        }
      }
      setRows(next)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const totalMembers = rows.reduce((a, r) => a + r.member_count, 0)
  const totalOnline = rows.reduce((a, r) => a + r.online_count, 0)
  const barData = rows.map((r) => ({
    name: r.name.length > 15 ? r.name.slice(0, 14) + '…' : r.name,
    members: r.member_count,
    online: r.online_count,
  }))
  const pieData = [
    { name: 'Online', value: totalOnline, color: '#22c55e' },
    { name: 'Offline', value: Math.max(0, totalMembers - totalOnline), color: '#64748b' },
  ].filter((d) => d.value > 0)

  const handleExportCSV = () => {
    exportCSV(
      rows.map((r) => ({ guild_id: r.guild_id, name: r.name, member_count: r.member_count, online_count: r.online_count })),
      'discord-stats.csv'
    )
  }
  const handleExportJSON = () => {
    exportJSON({ guilds: rows, total_members: totalMembers, total_online: totalOnline }, 'discord-stats.json')
  }

  return (
    <div className="space-y-8 py-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BarChart3 className="text-indigo-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Statistics</h1>
            <p className="text-slate-400 text-sm">Member counts and online presence</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm"
          >
            <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /> Refresh
          </button>
          {rows.length > 0 && (
            <>
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
            </>
          )}
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      {loading && rows.length === 0 && (
        <div className="flex items-center gap-2 text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading stats…
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4">
              <h2 className="text-sm font-bold text-slate-300 mb-4">Members per server</h2>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f0f12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      labelStyle={{ color: '#e2e8f0' }}
                    />
                    <Bar dataKey="members" fill="#6366f1" name="Members" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="online" fill="#22c55e" name="Online" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4">
              <h2 className="text-sm font-bold text-slate-300 mb-4">Total: Online vs offline</h2>
              <div className="h-[280px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={pieData[i].color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f0f12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        formatter={(v: number) => [v, '']}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">No data</div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
            <h2 className="p-4 text-sm font-bold text-slate-300 border-b border-white/10">Stats table</h2>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-4 text-sm font-bold text-slate-300">Server</th>
                  <th className="p-4 text-sm font-bold text-slate-300">Members</th>
                  <th className="p-4 text-sm font-bold text-slate-300">Online</th>
                  <th className="p-4 text-sm font-bold text-slate-300">Guild ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.guild_id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4 font-medium text-slate-200">{r.name}</td>
                    <td className="p-4 text-indigo-400 font-semibold">{r.member_count}</td>
                    <td className="p-4 text-emerald-400 font-semibold">{r.online_count}</td>
                    <td className="p-4 text-slate-500 font-mono text-sm">{r.guild_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
