import { useEffect, useState } from 'react'
import { Terminal, AlertCircle } from 'lucide-react'
import { api, type Meta } from '@/lib/api'

export default function Tools() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api
      .getMeta()
      .then(setMeta)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  return (
    <div className="space-y-6 pb-8 max-w-4xl">
      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6 text-indigo-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">MCP tools</h2>
            <p className="text-sm text-slate-500">
              Registered on the FastMCP server (stdio or HTTP). Inspect schemas in Cursor or your client.
            </p>
          </div>
        </div>
        {meta?.tools?.length ? (
          <ul className="grid gap-2">
            {meta.tools.map((t) => (
              <li
                key={t}
                className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 font-mono text-sm text-indigo-200/90"
              >
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm">Loading…</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-6 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Prompts</h3>
        {meta?.prompts?.length ? (
          <ul className="flex flex-wrap gap-2">
            {meta.prompts.map((p) => (
              <li
                key={p}
                className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 text-xs text-indigo-200"
              >
                {p}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm">—</p>
        )}
      </div>

      <p className="text-xs text-slate-600">
        HTTP MCP URL: <span className="font-mono text-slate-500">http://localhost:10756/mcp</span>
      </p>
    </div>
  )
}
