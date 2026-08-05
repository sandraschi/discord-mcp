import { Activity, Moon, Server, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { Health } from "@/lib/api";

// EXPERIMENTAL light mode (invert hack). Not fleet standard — see index.css.
// Toggling `.dark` off the root flips the invert filter; persisted so the
// choice survives reloads. Delete this + the CSS block to revert.
const THEME_KEY = "discord-light-mode";

function useExperimentalTheme() {
  const [light, setLight] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", !light);
    try {
      localStorage.setItem(THEME_KEY, light ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [light]);

  return { light, toggle: () => setLight((v) => !v) };
}

type Props = {
  title: string;
  subtitle?: string;
  health: Health | null;
};

export default function TopBar({ title, subtitle, health }: Props) {
  const tokenOk = health?.token_set === true;
  const samplingOk = health?.sampling?.server_side_llm_ready === true;
  const { light, toggle } = useExperimentalTheme();
  return (
    <header className="shrink-0 z-30 flex flex-col gap-3 pb-6 border-b border-white/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title={light ? "Switch to dark (experimental light mode)" : "Switch to light (experimental, ugly)"}
            aria-label="Toggle light mode (experimental)"
          >
            {light ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
              tokenOk
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Bot token {tokenOk ? "set" : "missing"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
              samplingOk
                ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                : "bg-slate-500/10 text-slate-400 border-white/10"
            }`}
            title="Server-side LLM for sampling (Ollama / OpenAI-compatible)"
          >
            <Activity className="w-3.5 h-3.5" />
            Sampling {samplingOk ? "ready" : "local LLM off"}
          </span>
        </div>
      </div>
    </header>
  );
}
