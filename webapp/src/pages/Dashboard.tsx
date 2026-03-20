import { useEffect, useState } from 'react'
import { Activity, AlertCircle, Cpu, Shield, Webhook } from 'lucide-react'
import { api, type Health } from '../lib/api'

export default function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.getHealth().then(setHealth).catch((e) => setErr(e.message))
    const t = setInterval(() => api.getHealth().then(setHealth).catch(() => {}), 5000)
    return () => clearInterval(t)
  }, [])

  const rl = health?.rate_limit
  const samp = health?.sampling

  return (
    <div className="space-y-6 pb-8 max-w-5xl">
      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}. Run start.ps1 to start the backend.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-200">Backend</h2>
          </div>
          <p className="text-2xl font-bold text-white">{health?.status === 'ok' ? 'OK' : '—'}</p>
          <p className="text-xs text-slate-500 mt-1">Service: {health?.service ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Webhook className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-200">MCP HTTP</h2>
          </div>
          <p className="text-sm font-mono text-indigo-300/90 break-all">
            {health?.mcp_http_path ? `http://localhost:10756${health.mcp_http_path}` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-2">Streamable HTTP (FastMCP 3.1)</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-bold text-slate-200">Sampling</h2>
          </div>
          <p className="text-2xl font-bold text-white">
            {samp?.server_side_llm_ready ? 'Ready' : 'Offline'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {samp?.sampling_model ?? '—'} @ {samp?.sampling_base_url ?? '—'}
          </p>
          {health?.sampling_use_client_llm_preferred ? (
            <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-wider">
              Client LLM preferred (handler fallback)
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-200">Bot token</h2>
          </div>
          <p className="text-2xl font-bold text-white">{health?.token_set ? 'Set' : 'Not set'}</p>
          <p className="text-xs text-slate-500 mt-1">DISCORD_TOKEN in .env</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 sm:col-span-2 lg:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-200">Rate limits</h2>
          </div>
          {rl ? (
            <ul className="text-xs text-slate-400 space-y-0.5 grid sm:grid-cols-2 gap-x-8">
              <li>
                Messages: {rl.messages_per_minute}/min, {rl.messages_per_channel_per_minute}/channel
              </li>
              <li>Channels: {rl.channels_per_minute}/min</li>
              <li>Invites: {rl.invites_per_minute}/min</li>
              <li>Min interval: {rl.min_message_interval_seconds}s</li>
            </ul>
          ) : (
            <p className="text-slate-500 text-sm">—</p>
          )}
        </div>
      </div>
    </div>
  )
}
