import { AlertCircle, Cpu, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type SamplingStatus, type ProviderInfo } from "../lib/api";

export default function Settings() {
  const [samp, setSamp] = useState<SamplingStatus | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setRefreshing(true);
    api
      .getProviders()
      .then((r) => {
        setSamp(r.sampling);
        setOllamaRunning(r.ollama_running);
        setProviders(r.providers);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6 py-4 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SettingsIcon className="text-indigo-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Settings
            </h1>
            <p className="text-slate-400 text-sm">
              LLM providers, sampling, and environment
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-300 text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-slate-500 text-sm py-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Discovering providers…</span>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-violet-400" />
              <h2 className="text-sm font-bold text-slate-200">
                Sampling status
              </h2>
            </div>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>
                Server-side LLM:{" "}
                <span
                  className={
                    samp?.server_side_llm_ready
                      ? "text-emerald-400"
                      : "text-slate-500"
                  }
                >
                  {samp?.server_side_llm_ready ? "Ready" : "Offline"}
                </span>
              </li>
              <li>
                Base URL:{" "}
                <span className="font-mono text-slate-300">
                  {samp?.sampling_base_url ?? "—"}
                </span>
              </li>
              <li>
                Model:{" "}
                <span className="font-mono text-slate-300">
                  {samp?.sampling_model ?? "—"}
                </span>
              </li>
              <li>
                API key:{" "}
                {samp?.has_api_key ? (
                  <span className="text-emerald-400">Set</span>
                ) : (
                  <span className="text-slate-500">Not set</span>
                )}
                {samp?.has_api_key ? null : (
                  <span className="text-xs text-slate-600 ml-2">
                    (optional for local Ollama)
                  </span>
                )}
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-200">
              Available providers
            </h2>
            <ul className="space-y-3">
              {providers.map((p) => (
                <li
                  key={p.name}
                  className="rounded-xl border border-white/5 bg-black/25 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200">{p.name}</span>
                    <span
                      className={
                        p.available
                          ? "text-xs text-emerald-400 font-medium"
                          : "text-xs text-slate-500"
                      }
                    >
                      {p.available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                  {p.type === "ollama" && (
                    <div className="mt-2 text-xs text-slate-500 space-y-1">
                      <p>
                        Ollama is{" "}
                        {ollamaRunning
                          ? "running on http://127.0.0.1:11434"
                          : "not detected. Start Ollama for local LLM sampling."}
                      </p>
                      {p.default_url && (
                        <p>
                          Default URL:{" "}
                          <span className="font-mono text-slate-400">
                            {p.default_url}
                          </span>
                        </p>
                      )}
                      <p>
                        Env vars:{" "}
                        <span className="font-mono text-slate-400">
                          {p.env_base_url}, {p.env_model}, {p.env_api_key}
                        </span>
                      </p>
                    </div>
                  )}
                  {p.type === "client" && (
                    <p className="mt-2 text-xs text-slate-500">
                      Set{" "}
                      <span className="font-mono text-slate-400">
                        DISCORD_SAMPLING_USE_CLIENT_LLM=1
                      </span>{" "}
                      to prefer the MCP host LLM for sampling.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-2">
              DISCORD_TOKEN
            </h2>
            <p className="text-slate-400 text-sm">
              Set in environment or{" "}
              <span className="font-mono text-slate-300">.env</span> (not stored
              in browser). Create a bot at{" "}
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                Discord Developer Portal
              </a>{" "}
              and invite it to your server.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
