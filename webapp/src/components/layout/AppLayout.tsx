import type React from "react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, RefreshCw } from "lucide-react";
import { api, type Health } from "@/lib/api";
import { useServerStore } from "@/store/serverStore";
import LoggerPanel, { type LogEntry } from "./LoggerPanel";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const PAGE_COPY: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Health, sampling, and quick links.",
  },
  "/chat": {
    title: "Agentic Chat",
    subtitle: "Describe a Discord task and the agent will help.",
  },
  "/guilds": { title: "Servers", subtitle: "Servers the bot can access." },
  "/channels": {
    title: "Channels",
    subtitle: "Channels in the selected server.",
  },
  "/invites": { title: "Invites", subtitle: "Server invite codes and URLs." },
  "/members": { title: "Members", subtitle: "Requires the GUILD_MEMBERS intent." },
  "/messages": { title: "Messages", subtitle: "Recent messages in a channel." },
  "/send": {
    title: "Send message",
    subtitle: "Rate-limited outbound messages.",
  },
  "/favorites": { title: "Favorites", subtitle: "Saved servers and channels." },
  "/trawl": { title: "Trawl", subtitle: "Scan patterns across channels." },
  "/rag": { title: "RAG", subtitle: "LanceDB ingest and semantic search." },
  "/stats": { title: "Statistics", subtitle: "Server presence and counts." },
  "/tools": { title: "Tools", subtitle: "MCP tool surface (stdio + HTTP)." },
  "/skills": { title: "Skills", subtitle: "Bundled SKILL.md resources." },
  "/apps": { title: "Apps", subtitle: "Fleet and related services." },
  "/settings": {
    title: "Settings",
    subtitle: "LLM providers, sampling, and environment.",
  },
  "/help": { title: "Help", subtitle: "Setup and operations." },
};

function ts() {
  return new Date().toISOString().split("T")[1].slice(0, 12);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const copy = PAGE_COPY[location.pathname] ?? {
    title: "Discord MCP",
    subtitle: "Fleet dashboard",
  };
  const [health, setHealth] = useState<Health | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // Global server-list status: every page inherits this banner, so a dead
  // backend or bad token is never a silent blank page.
  const guilds = useServerStore((s) => s.guilds);
  const guildsLoading = useServerStore((s) => s.loading);
  const guildsError = useServerStore((s) => s.error);
  const loadGuilds = useServerStore((s) => s.loadGuilds);

  useEffect(() => {
    if (guilds.length === 0 && !guildsLoading && !guildsError) loadGuilds();
  }, [guilds.length, guildsLoading, guildsError, loadGuilds]);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    const poll = async () => {
      try {
        const h = await api.getHealth();
        if (!cancelled) {
          setHealth(h);
          if (first) {
            first = false;
            setLogs((prev) => [
              ...prev.slice(-200),
              {
                t: ts(),
                level: "INFO",
                message: `connected token_set=${h.token_set}`,
              },
            ]);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setHealth(null);
          const msg = e instanceof Error ? e.message : "health fetch failed";
          setLogs((prev) => [
            ...prev.slice(-200),
            { t: ts(), level: "ERROR", message: msg },
          ]);
        }
      }
    };
    poll();
    const id = window.setInterval(poll, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="flex w-screen h-screen bg-[#07070a] text-slate-200 overflow-hidden font-sans">
      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />
      <main className="flex-1 flex flex-col overflow-hidden bg-[#07070a] relative min-w-0">
        <div className="absolute top-0 right-0 w-[520px] h-[520px] bg-indigo-600/[0.07] blur-[140px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-600/[0.05] blur-[100px] rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        <div className="flex-1 overflow-y-auto relative z-10 pb-36 w-full">
          <div className="max-w-7xl mx-auto w-full px-6 lg:px-10 pt-8">
            <TopBar
              title={copy.title}
              subtitle={copy.subtitle}
              health={health}
            />
            {guildsLoading && guilds.length === 0 && (
              <p className="text-slate-400 text-sm mb-4">Loading servers…</p>
            )}
            {guildsError && (
              <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-200 mb-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm flex-1">
                  Servers unavailable: {guildsError} — check the backend
                  (start.ps1, port 10756) and DISCORD_TOKEN.
                </p>
                <button
                  type="button"
                  onClick={() => loadGuilds()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-200 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            )}
            {children}
          </div>
        </div>
      </main>
      <LoggerPanel lines={logs} />
    </div>
  );
}
