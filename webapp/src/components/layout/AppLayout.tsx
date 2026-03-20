import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import LoggerPanel, { type LogEntry } from './LoggerPanel'
import { api, type Health } from '@/lib/api'

const PAGE_COPY: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Health, sampling, and quick links.' },
  '/guilds': { title: 'Guilds', subtitle: 'Servers the bot can access.' },
  '/channels': { title: 'Channels', subtitle: 'Channels for a selected guild.' },
  '/invites': { title: 'Invites', subtitle: 'Guild invite codes and URLs.' },
  '/members': { title: 'Members', subtitle: 'Requires GUILD_MEMBERS intent.' },
  '/messages': { title: 'Messages', subtitle: 'Recent messages in a channel.' },
  '/send': { title: 'Send message', subtitle: 'Rate-limited outbound messages.' },
  '/favorites': { title: 'Favorites', subtitle: 'Saved guild / channel IDs.' },
  '/trawl': { title: 'Trawl', subtitle: 'Scan patterns across channels.' },
  '/rag': { title: 'RAG', subtitle: 'LanceDB ingest and semantic search.' },
  '/stats': { title: 'Statistics', subtitle: 'Guild presence and counts.' },
  '/tools': { title: 'Tools', subtitle: 'MCP tool surface (stdio + HTTP).' },
  '/skills': { title: 'Skills', subtitle: 'Bundled SKILL.md resources.' },
  '/apps': { title: 'Apps', subtitle: 'Fleet and related services.' },
  '/settings': { title: 'Settings', subtitle: 'Environment and limits reference.' },
  '/help': { title: 'Help', subtitle: 'Setup and operations.' },
}

function ts() {
  return new Date().toISOString().split('T')[1].slice(0, 12)
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  const copy = PAGE_COPY[location.pathname] ?? { title: 'Discord MCP', subtitle: 'Fleet dashboard' }
  const [health, setHealth] = useState<Health | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    let cancelled = false
    let first = true
    const poll = async () => {
      try {
        const h = await api.getHealth()
        if (!cancelled) {
          setHealth(h)
          if (first) {
            first = false
            setLogs((prev) => [
              ...prev.slice(-200),
              { t: ts(), level: 'INFO', message: `connected token_set=${h.token_set}` },
            ])
          }
        }
      } catch (e) {
        if (!cancelled) {
          setHealth(null)
          const msg = e instanceof Error ? e.message : 'health fetch failed'
          setLogs((prev) => [...prev.slice(-200), { t: ts(), level: 'ERROR', message: msg }])
        }
      }
    }
    poll()
    const id = window.setInterval(poll, 15000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <div className="flex w-screen h-screen bg-[#07070a] text-slate-200 overflow-hidden font-sans">
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      <main className="flex-1 flex flex-col overflow-hidden bg-[#07070a] relative min-w-0">
        <div className="absolute top-0 right-0 w-[520px] h-[520px] bg-indigo-600/[0.07] blur-[140px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-600/[0.05] blur-[100px] rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        <div className="flex-1 overflow-y-auto relative z-10 pb-36 w-full">
          <div className="max-w-7xl mx-auto w-full px-6 lg:px-10 pt-8">
            <TopBar title={copy.title} subtitle={copy.subtitle} health={health} />
            {children}
          </div>
        </div>
      </main>
      <LoggerPanel lines={logs} />
    </div>
  )
}
