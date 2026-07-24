import { AlertCircle, Cpu, RefreshCw, Settings as SettingsIcon, Shield, Key, Link, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type ProviderInfo, type IntentsResponse } from "../lib/api";

const LLM_PROVIDER_KEY = "discord-mcp-llm-provider";
const LLM_MODEL_KEY = "discord-mcp-llm-model";

function loadLlmProvider(): string {
  try { return localStorage.getItem(LLM_PROVIDER_KEY) || ""; } catch { return ""; }
}
function loadLlmModel(): string {
  try { return localStorage.getItem(LLM_MODEL_KEY) || ""; } catch { return ""; }
}

export default function Settings() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [intents, setIntents] = useState<IntentsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [discordToken, setDiscordToken] = useState("");
  const [samplingModel, setSamplingModel] = useState("");
  const [samplingBaseUrl, setSamplingBaseUrl] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState(loadLlmProvider);
  const [selectedModel, setSelectedModel] = useState(loadLlmModel);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const detectedProviders: { name: string; port: number; base: string }[] = [];
  if (ollamaRunning) detectedProviders.push({ name: "Ollama", port: 11434, base: "http://127.0.0.1:11434" });
  providers.filter((p) => p.available).forEach((p) => {
    if (p.name !== "ollama" && !detectedProviders.find((d) => d.name === p.name)) {
      detectedProviders.push({ name: p.name, port: 0, base: p.default_url || "" });
    }
  });

  const fetchModels = async (providerName: string) => {
    if (providerName === "Ollama" && ollamaRunning) {
      try {
        const r = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(3000) });
        const data = await r.json();
        const models = (data.models || []).map((m: any) => m.name);
        setAvailableModels(models);
        if (models.length > 0 && !models.includes(selectedModel)) {
          setSelectedModel(models[0]);
        }
      } catch {
        setAvailableModels([]);
      }
    } else {
      setAvailableModels([]);
    }
  };

  useEffect(() => {
    if (selectedProvider) fetchModels(selectedProvider);
  }, [selectedProvider]);

  const load = () => {
    setRefreshing(true);
    Promise.all([api.getProviders(), api.getIntents(), api.getHealth()])
      .then(([provRes, intRes, healthRes]) => {
        setOllamaRunning(provRes.ollama_running);
        setProviders(provRes.providers);
        setIntents(intRes);
        if (healthRes.token_set && !discordToken) setDiscordToken("••••••••••••••••••••••••");
        if (provRes.sampling.sampling_model && !samplingModel) setSamplingModel(provRes.sampling.sampling_model);
        if (provRes.sampling.sampling_base_url && !samplingBaseUrl) setSamplingBaseUrl(provRes.sampling.sampling_base_url);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load settings"))
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setErr(null);
    const payload: Record<string, string> = {};
    if (discordToken && discordToken !== "••••••••••••••••••••••••") payload.DISCORD_TOKEN = discordToken;
    if (samplingModel) payload.DISCORD_SAMPLING_MODEL = samplingModel;
    if (samplingBaseUrl) payload.DISCORD_SAMPLING_BASE_URL = samplingBaseUrl;
    api.saveSettings(payload)
      .then((r) => {
        if (r.success) { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); load(); }
        else setErr(r.error || "Failed to save settings");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Save failed"));
  };

  return (
    <div className="space-y-6 py-4 max-w-4xl" data-testid="settings-page">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SettingsIcon className="text-indigo-400 w-8 h-8 animate-spin-slow" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Settings & Wizard</h1>
            <p className="text-slate-400 text-sm">LLM providers, sampling, credentials, and bot intent diagnostics</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={refreshing} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-sm disabled:opacity-50 transition-colors border border-white/5">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Run Diagnostics
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{err}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-slate-500 text-sm py-4">
          <RefreshCw className="w-4 h-4 animate-spin" /><span>Discovering bot state & providers…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 space-y-4">
              <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                <Shield className="w-5 h-5 text-indigo-400" /><h2 className="text-base font-bold text-white">Bot Diagnostics</h2>
              </div>
              {intents?.token_valid ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" /><span>Token valid — connected as <strong>@{intents.username}</strong></span>
                  </div>
                  <div className="space-y-3 bg-black/35 rounded-xl p-4 border border-white/5">
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Intent Status</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Server Members Intent</span>
                      {intents.intents.guild_members ? <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">Enabled</span> : <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">Disabled</span>}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Message Content Intent</span>
                      {intents.intents.message_content ? <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">Active</span> : <span className="text-xs bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-0.5 rounded-full font-medium">Inactive</span>}
                    </div>
                  </div>
                  {intents.invite_url && (
                    <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 uppercase tracking-wider"><Link className="w-3.5 h-3.5" /><span>OAuth Bot Invite Link</span></div>
                      <p className="text-xs text-slate-400">Invite @{intents.username} to new servers:</p>
                      <a href={intents.invite_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-indigo-500/10">Invite Bot to Server</a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 text-sm"><XCircle className="w-4 h-4 shrink-0" /><span>Bot token missing or invalid</span></div>
                  <p className="text-xs text-slate-400">Generate a bot token in the Discord Developer Portal and paste it on the right panel.</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 space-y-4">
              <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                <Cpu className="w-5 h-5 text-violet-400" /><h2 className="text-base font-bold text-white">LLM Provider</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Provider</label>
                  <select
                    data-testid="llm-provider-select"
                    value={selectedProvider}
                    onChange={(e) => { setSelectedProvider(e.target.value); localStorage.setItem(LLM_PROVIDER_KEY, e.target.value); }}
                    className="w-full rounded-xl bg-zinc-800 text-zinc-100 border border-zinc-600 px-3 py-2 text-sm"
                  >
                    {detectedProviders.length === 0 ? (
                      <option value="">No local LLM detected</option>
                    ) : (
                      detectedProviders.map((p) => <option key={p.name} value={p.name}>{p.name} (:{(p as any).port || "?"})</option>)
                    )}
                  </select>
                </div>

                {selectedProvider && (
                  <div>
                    <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Model</label>
                    <select
                      data-testid="llm-model-select"
                      value={selectedModel}
                      onChange={(e) => { setSelectedModel(e.target.value); localStorage.setItem(LLM_MODEL_KEY, e.target.value); }}
                      className="w-full rounded-xl bg-zinc-800 text-zinc-100 border border-zinc-600 px-3 py-2 text-sm"
                    >
                      {availableModels.length === 0 ? (
                        <option value="">No models found</option>
                      ) : (
                        availableModels.map((m) => <option key={m} value={m}>{m}</option>)
                      )}
                    </select>
                  </div>
                )}

                {!ollamaRunning && (
                  <p className="text-xs text-amber-500">Start Ollama or LM Studio to enable local inference.</p>
                )}
              </div>

              <ul className="space-y-3">
                {providers.map((p) => (
                  <li key={p.name} className="rounded-xl border border-white/5 bg-black/25 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{p.name}</span>
                      <span className={p.available ? "text-emerald-400 font-medium" : "text-slate-500"}>{p.available ? "Available" : "Not Detected"}</span>
                    </div>
                    {p.type === "ollama" && <p className="text-slate-500 text-[10px]">{ollamaRunning ? "Running on :11434" : "Start Ollama to enable local sampling."}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 space-y-4">
              <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                <Key className="w-5 h-5 text-emerald-400 animate-pulse" /><h2 className="text-base font-bold text-white">Configure Environment</h2>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">DISCORD_TOKEN</label>
                  <input type="password" value={discordToken} onChange={(e) => setDiscordToken(e.target.value)} placeholder="Enter your bot token" className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50" />
                  <span className="text-[10px] text-slate-500 mt-1 block">Overrides values in repo .env.</span>
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Sampling Model</label>
                  <input type="text" value={samplingModel} onChange={(e) => setSamplingModel(e.target.value)} placeholder="e.g. llama3.2" className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 font-mono" />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Sampling Base URL</label>
                  <input type="text" value={samplingBaseUrl} onChange={(e) => setSamplingBaseUrl(e.target.value)} placeholder="e.g. http://127.0.0.1:11434/v1" className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 font-mono" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/20">Apply Config</button>
                </div>
                {saveSuccess && <div className="p-3 bg-emerald-500/10 text-emerald-300 rounded-xl text-xs text-center border border-emerald-500/20 font-medium">Configuration saved!</div>}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
