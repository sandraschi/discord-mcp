import { Activity, Server } from 'lucide-react'
import type { Health } from '@/lib/api'

type Props = {
  title: string
  subtitle?: string
  health: Health | null
}

export default function TopBar({ title, subtitle, health }: Props) {
  const tokenOk = health?.token_set === true
  const samplingOk = health?.sampling?.server_side_llm_ready === true
  return (
    <header className="shrink-0 z-30 flex flex-col gap-3 pb-6 border-b border-white/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
              tokenOk
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Bot token {tokenOk ? 'set' : 'missing'}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
              samplingOk
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                : 'bg-slate-500/10 text-slate-400 border-white/10'
            }`}
            title="Server-side LLM for sampling (Ollama / OpenAI-compatible)"
          >
            <Activity className="w-3.5 h-3.5" />
            Sampling {samplingOk ? 'ready' : 'local LLM off'}
          </span>
        </div>
      </div>
    </header>
  )
}
