import { useEffect, useState } from 'react'
import { BookMarked, AlertCircle, Copy } from 'lucide-react'
import { api, type SkillEntry } from '@/lib/api'

export default function Skills() {
  const [skills, setSkills] = useState<SkillEntry[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api
      .getSkills()
      .then((r) => setSkills(r.skills ?? []))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

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
          <BookMarked className="w-6 h-6 text-violet-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Bundled skills</h2>
            <p className="text-sm text-slate-500">
              Exposed to MCP clients as <span className="font-mono text-slate-400">skill://…/SKILL.md</span>.
              Copy below or install into your Cursor / Claude skills folder.
            </p>
          </div>
        </div>

        {skills.length === 0 ? (
          <p className="text-slate-500 text-sm">No skills found on the server.</p>
        ) : (
          <ul className="space-y-4">
            {skills.map((s) => (
              <li
                key={s.name}
                className="rounded-xl border border-white/5 bg-black/25 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                  <span className="font-mono text-sm text-indigo-300">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => copy(s.preview)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy preview
                  </button>
                </div>
                <pre className="text-xs text-slate-400 whitespace-pre-wrap p-4 max-h-64 overflow-y-auto font-mono leading-relaxed">
                  {s.preview}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
