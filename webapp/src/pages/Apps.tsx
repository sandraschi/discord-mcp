import { LayoutGrid, ExternalLink } from 'lucide-react'

const EXTERNAL = [
  {
    title: 'Glama discovery',
    href: 'https://glama.ai',
    note: 'MCP server registry and manifests.',
  },
  {
    title: 'Discord Developer Portal',
    href: 'https://discord.com/developers/applications',
    note: 'Bot tokens, intents, OAuth2.',
  },
]

export default function Apps() {
  return (
    <div className="space-y-6 pb-8 max-w-3xl">
      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <LayoutGrid className="w-6 h-6 text-indigo-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Fleet &amp; ecosystem</h2>
            <p className="text-sm text-slate-500">
              This repo includes <span className="font-mono text-slate-400">glama.json</span> for local
              discovery. Central fleet standards live in your{' '}
              <span className="font-mono text-slate-400">mcp-central-docs</span> clone (open that workspace
              for AGENT_PROTOCOLS / WEBAPP_STANDARDS).
            </p>
          </div>
        </div>
        <ul className="space-y-3">
          {EXTERNAL.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3 hover:border-indigo-500/30 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-slate-500 shrink-0 mt-0.5 group-hover:text-indigo-400" />
                <div>
                  <div className="text-sm font-medium text-indigo-200 group-hover:text-indigo-100">
                    {l.title}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{l.note}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
