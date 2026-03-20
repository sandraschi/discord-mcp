import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react'

export type LogEntry = { t: string; level: string; message: string }

type Props = {
  lines: LogEntry[]
  defaultOpen?: boolean
}

export default function LoggerPanel({ lines, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [paused, setPaused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || paused || !ref.current) return
    ref.current.scrollTop = ref.current.scrollHeight
  }, [lines, open, paused])

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none flex justify-center">
      <div
        className="pointer-events-auto w-full max-w-7xl mx-auto px-4 mb-4"
        style={{ marginLeft: 'max(1rem, env(safe-area-inset-left))' }}
      >
        <div className="rounded-2xl border border-white/10 bg-[#0c0c10]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-slate-300 hover:bg-white/[0.03] transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Terminal className="w-4 h-4 text-indigo-400" />
              Activity log
            </span>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {open ? (
            <div className="border-t border-white/5">
              <div className="flex items-center justify-end px-3 py-1.5 border-b border-white/5 bg-black/20">
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={paused}
                    onChange={(e) => setPaused(e.target.checked)}
                    className="rounded border-white/20 bg-transparent"
                  />
                  Pause auto-scroll
                </label>
              </div>
              <div
                ref={ref}
                className="h-36 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-400"
              >
                {lines.length === 0 ? (
                  <span className="text-slate-600">No events yet.</span>
                ) : (
                  lines.map((line, i) => (
                    <div key={`${line.t}-${i}`} className="whitespace-pre-wrap break-all">
                      <span className="text-slate-600">{line.t}</span>{' '}
                      <span
                        className={
                          line.level === 'ERROR'
                            ? 'text-red-400'
                            : line.level === 'WARN'
                              ? 'text-amber-400'
                              : 'text-slate-500'
                        }
                      >
                        [{line.level}]
                      </span>{' '}
                      {line.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
