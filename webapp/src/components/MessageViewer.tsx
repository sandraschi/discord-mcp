import { useMemo, useState } from 'react'
import type { Message } from '../lib/api'

const VIEW_MODES = ['list', 'compact', 'card', 'thread', 'pointcloud'] as const
export type ViewMode = (typeof VIEW_MODES)[number]

function formatTime(ts: string | undefined): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

function MessageContent({ m, compact = false }: { m: Message; compact?: boolean }) {
  const content = m.content || '(empty)'
  const hasRef = m.referenced_message
  const hasAttach = (m.attachments?.length ?? 0) > 0
  const hasEmbed = (m.embeds?.length ?? 0) > 0
  const cls = compact ? 'text-slate-400 text-xs truncate max-w-full' : 'text-slate-300 break-words'
  return (
    <div className="space-y-1">
      {hasRef && (
        <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-500 text-sm">
          <span className="font-medium text-slate-400">{m.referenced_message?.author}</span>
          <span className="ml-1">{m.referenced_message?.content?.slice(0, 80) ?? ''}</span>
        </div>
      )}
      <p className={cls}>{content}</p>
      {!compact && (hasAttach || hasEmbed) && (
        <div className="flex flex-wrap gap-2 mt-1">
          {m.attachments?.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline text-sm"
            >
              {a.filename ?? 'attachment'}
            </a>
          ))}
          {m.embeds?.map((e, i) => (
            <a
              key={i}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400/90 hover:underline text-sm"
            >
              {e.title || e.description?.slice(0, 30) || 'embed'}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function ListItem({ m }: { m: Message }) {
  return (
    <li className="p-4 hover:bg-white/5 border-b border-white/5 last:border-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-medium text-amber-400/90">{m.author}</span>
        {m.timestamp && (
          <span className="text-slate-500 text-xs">{formatTime(m.timestamp)}</span>
        )}
        {m.edited_timestamp && (
          <span className="text-slate-600 text-xs">(edited)</span>
        )}
      </div>
      <div className="mt-1">
        <MessageContent m={m} />
      </div>
    </li>
  )
}

function CompactItem({ m }: { m: Message }) {
  return (
    <li className="py-1.5 px-2 hover:bg-white/5 flex items-center gap-2 border-b border-white/5 last:border-0 min-w-0">
      <span className="text-amber-400/90 text-xs font-medium shrink-0 max-w-[120px] truncate">
        {m.author}
      </span>
      <span className="text-slate-500 text-xs shrink-0">{formatTime(m.timestamp)}</span>
      <MessageContent m={m} compact />
    </li>
  )
}

function CardItem({ m }: { m: Message }) {
  return (
    <li className="rounded-xl border border-white/10 bg-[#0f0f12]/80 p-4 hover:border-white/20 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0">
          {(m.author || '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{m.author}</span>
            {m.timestamp && (
              <span className="text-slate-500 text-xs">{formatTime(m.timestamp)}</span>
            )}
            {m.edited_timestamp && (
              <span className="text-slate-600 text-xs">(edited)</span>
            )}
          </div>
          <div className="mt-2">
            <MessageContent m={m} />
          </div>
        </div>
      </div>
    </li>
  )
}

function buildThreadTree(messages: Message[]): { root: Message; children: Message[] }[] {
  const byId = new Map<string, Message>()
  messages.forEach((m) => byId.set(m.id, m))
  const roots: Message[] = []
  const children = new Map<string, Message[]>()
  messages.forEach((m) => {
    const refId = m.referenced_message?.id
    if (refId && byId.has(refId)) {
      const list = children.get(refId) ?? []
      list.push(m)
      children.set(refId, list)
    } else {
      roots.push(m)
    }
  })
  roots.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
  return roots.map((root) => ({
    root,
    children: (children.get(root.id) ?? []).sort((a, b) =>
      (a.timestamp || '').localeCompare(b.timestamp || '')
    ),
  }))
}

function ThreadNode({ m, depth }: { m: Message; depth: number }) {
  return (
    <div className={depth > 0 ? 'ml-4 mt-2 border-l-2 border-white/10 pl-3' : ''}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-medium text-amber-400/90">{m.author}</span>
        <span className="text-slate-500 text-xs">{formatTime(m.timestamp)}</span>
      </div>
      <MessageContent m={m} />
    </div>
  )
}

function ThreadTree({ trees }: { trees: { root: Message; children: Message[] }[] }) {
  return (
    <ul className="space-y-4">
      {trees.map(({ root, children }) => (
        <li key={root.id} className="rounded-xl border border-white/10 bg-[#0f0f12]/50 p-4">
          <ThreadNode m={root} depth={0} />
          {children.map((c) => (
            <ThreadNode key={c.id} m={c} depth={1} />
          ))}
        </li>
      ))}
    </ul>
  )
}

function PointCloud({
  messages,
  onSelect,
  selectedId,
}: {
  messages: Message[]
  onSelect: (id: string) => void
  selectedId: string | null
}) {
  const authorList = useMemo(() => {
    const set = new Set(messages.map((m) => m.author))
    return Array.from(set)
  }, [messages])
  const authorIndex = (a: string) => {
    const i = authorList.indexOf(a)
    return i >= 0 ? i : authorList.length
  }
  const width = 800
  const height = 400
  const padding = { top: 20, right: 20, bottom: 40, left: 50 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const maxLen = Math.max(1, ...messages.map((m) => m.content.length))
  const points = messages.map((m, i) => ({
    ...m,
    x: padding.left + (i / Math.max(1, messages.length - 1)) * innerW,
    y: padding.top + (authorIndex(m.author) / Math.max(1, authorList.length)) * innerH * 0.6
      + (m.content.length / maxLen) * innerH * 0.4,
  }))
  const r = 6
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
      <p className="p-2 text-slate-500 text-xs">
        X: time order, Y: author + length. Click a point to highlight.
      </p>
      <svg width={width} height={height} className="overflow-visible">
        {authorList.map((a, i) => (
          <text
            key={a}
            x={padding.left - 8}
            y={padding.top + ((i + 0.5) / Math.max(1, authorList.length)) * innerH * 0.6}
            className="fill-slate-500 text-[10px]"
            textAnchor="end"
          >
            {a.slice(0, 8)}
          </text>
        ))}
        {points.map((p) => (
          <g key={p.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={r}
              fill={selectedId === p.id ? 'rgb(129 140 248)' : 'rgb(100 116 139 / 0.6)'}
              stroke={selectedId === p.id ? 'rgb(165 180 252)' : 'transparent'}
              strokeWidth={2}
              className="cursor-pointer"
              onClick={() => onSelect(selectedId === p.id ? '' : p.id)}
            />
            <title>{p.author}: {(p.content || '').slice(0, 60)}</title>
          </g>
        ))}
      </svg>
    </div>
  )
}

export default function MessageViewer({
  messages,
  viewMode,
  onViewModeChange,
}: {
  messages: Message[]
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}) {
  const [pointSelectedId, setPointSelectedId] = useState<string | null>(null)
  const threadTrees = useMemo(() => buildThreadTree(messages), [messages])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-500 text-sm">View:</span>
        {VIEW_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            className={
              viewMode === mode
                ? 'px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium'
                : 'px-3 py-1.5 rounded-lg bg-slate-700/80 text-slate-300 text-sm hover:bg-slate-600'
            }
          >
            {mode}
          </button>
        ))}
      </div>

      {viewMode === 'list' && (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden max-h-[65vh] overflow-y-auto">
          {messages.map((m) => (
            <ListItem key={m.id} m={m} />
          ))}
        </ul>
      )}

      {viewMode === 'compact' && (
        <ul className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden max-h-[65vh] overflow-y-auto">
          {messages.map((m) => (
            <CompactItem key={m.id} m={m} />
          ))}
        </ul>
      )}

      {viewMode === 'card' && (
        <ul className="grid gap-3 max-h-[65vh] overflow-y-auto pr-1">
          {messages.map((m) => (
            <CardItem key={m.id} m={m} />
          ))}
        </ul>
      )}

      {viewMode === 'thread' && (
        <div className="max-h-[65vh] overflow-y-auto">
          <ThreadTree trees={threadTrees} />
        </div>
      )}

      {viewMode === 'pointcloud' && (
        <div className="space-y-2">
          <PointCloud
            messages={messages}
            onSelect={setPointSelectedId}
            selectedId={pointSelectedId}
          />
          {pointSelectedId && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
              {messages.find((m) => m.id === pointSelectedId) && (
                <ListItem m={messages.find((m) => m.id === pointSelectedId)!} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
