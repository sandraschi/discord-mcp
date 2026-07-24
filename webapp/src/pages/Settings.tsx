import { AlertCircle, Cpu, RefreshCw, Settings as SettingsIcon, Shield, Key, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type IntentsResponse } from "../lib/api";

const LLM_PROVIDER_KEY = "discord-mcp-llm-provider";
const LLM_MODEL_KEY = "discord-mcp-llm-model";

type ProviderItem = { name: string; port: number; base: string };
type ProviderStatus = "probing" | "detected" | "not_found";

const PROVIDERS_TO_PROBE: ProviderItem[] = [
  { name: "Ollama", port: 11434, base: "http://127.0.0.1:11434" },
  { name: "LM Studio", port: 1234, base: "http://127.0.0.1:1234" },
  { name: "vLLM", port: 8000, base: "http://127.0.0.1:8000" },
];

function loadLlmProvider(): string {
  try { return localStorage.getItem(LLM_PROVIDER_KEY) || ""; } catch { return ""; }
}
function loadLlmModel(): string {
  try { return localStorage.getItem(LLM_MODEL_KEY) || ""; } catch { return ""; }
}

async function probeProvider(p: ProviderItem): Promise<"detected" | "not_found"> {
  const endpoint = p.name === "Ollama" ? "/api/tags" : "/v1/models";
  try {
    const r = await fetch(`${p.base}${endpoint}`, { signal: AbortSignal.timeout(3000) });
    return r.ok ? "detected" : "not_found";
  } catch {
    return "not_found";
  }
}

async function fetchModels(provider: ProviderItem): Promise<string[]> {
  try {
    if (provider.name === "Ollama") {
      const r = await fetch(`${provider.base}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) return [];
      const data = await r.json();
      return (data.models || []).map((m: any) => m.name);
    }
    const r = await fetch(`${provider.base}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((m: any) => m.id || m.name);
  } catch {
    return [];
  }
}

export default function Settings() {
  const [intents, setIntents] = useState<IntentsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [discordToken, setDiscordToken] = useState("");
  const [samplingModel, setSamplingModel] = useState("");
  const [samplingBaseUrl, setSamplingBaseUrl] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({});
  const [detectedProviders, setDetectedProviders] = useState<ProviderItem[]>([]);
  const [selectedProvider, setSelectedProvider] = useState(loadLlmProvider);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(loadLlmModel);
  const [modelsLoading, setModelsLoading] = useState(false);

  const runProbe = async () => {
    setProviderStatus(Object.fromEntries(PROVIDERS_TO_PROBE.map((p) => [p.name, "probing"])));
    const results = await Promise.all(PROVIDERS_TO_PROBE.map(async (p) => {
      const status = await probeProvider(p);
      return { name: p.name, item: p, status };
    }));
    const statusMap: Record<string, ProviderStatus> = {};
    const detected: ProviderItem[] = [];
    for (const r of results) {
      statusMap[r.name] = r.status;
      if (r.status === "detected") detected.push(r.item);
    }
    setProviderStatus(statusMap);
    setDetectedProviders(detected);

    const saved = loadLlmProvider();
    if (saved && detected.find((d) => d.name === saved)) {
      setSelectedProvider(saved);
    } else if (detected.length > 0) {
      setSelectedProvider(detected[0].name);
    } else {
      setSelectedProvider("");
    }
  };

  useEffect(() => {
    if (selectedProvider) {
      const prov = PROVIDERS_TO_PROBE.find((p) => p.name === selectedProvider);
      if (prov && providerStatus[selectedProvider] === "detected") {
        setModelsLoading(true);
        fetchModels(prov).then((models) => {
          setAvailableModels(models);
          const saved = loadLlmModel();
          if (saved && models.includes(saved)) {
            setSelectedModel(saved);
          } else if (models.length > 0) {
            setSelectedModel(models[0]);
          }
        }).finally(() => setModelsLoading(false));
      }
    }
  }, [selectedProvider, providerStatus]);

  const load = () => {
    Promise.all([api.getIntents(), api.getHealth()])
      .then(([intRes, healthRes]) => {
        setIntents(intRes);
        if (healthRes.token_set && !discordToken) setDiscordToken("••••••••••••••••••••••••");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  };

  useEffect(() => { load(); runProbe(); }, []);

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
        if (r.success) { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); }
        else setErr(r.error || "Failed");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Save failed"));
  };

  const gpuPrompt = detectedProviders.length === 0 && (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
      No local LLM detected.
      {navigator.hardwareConcurrency >= 8 && <span> High-performance CPU detected — install <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline">Ollama</a> to unlock AI features for free.</span>}
    </div>
  );

  return (
    <div className="space-y-6 py-4 max-w-4xl" data-testid="settings-page">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SettingsIcon className="text-indigo-400 w-8 h-8 animate-spin-slow" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
            <p className="text-slate-400 text-sm">LLM providers, bot diagnostics, environment config</p>
          </div>
        </div>
        <button type="button" onClick={() => { load(); runProbe(); }} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm border border-white/5">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{err}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <Cpu className="w-5 h-5 text-violet-400" /><h2 className="text-base font-bold text-white">Local LLM</h2>
            </div>

            <div className="space-y-2">
              {PROVIDERS_TO_PROBE.map((p) => (
                <div key={p.name} className="flex items-center justify-between rounded-xl bg-black/25 border border-white/5 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Cpu className={`w-4 h-4 ${providerStatus[p.name] === "detected" ? "text-emerald-400" : providerStatus[p.name] === "probing" ? "text-slate-500 animate-pulse" : "text-slate-600"}`} />
                    <span className="text-sm text-slate-200">{p.name}</span>
                    <span className="text-xs text-slate-500">:{p.port}</span>
                  </div>
                  <span className={`text-xs font-medium ${providerStatus[p.name] === "detected" ? "text-emerald-400" : providerStatus[p.name] === "probing" ? "text-slate-500" : "text-slate-600"}`}>
                    {providerStatus[p.name] === "detected" ? "Detected" : providerStatus[p.name] === "probing" ? "Probing..." : "Not found"}
                  </span>
                </div>
              ))}
            </div>

            {gpuPrompt}

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Provider</label>
                <select
                  data-testid="llm-provider-select"
                  value={selectedProvider}
                  onChange={(e) => { setSelectedProvider(e.target.value); localStorage.setItem(LLM_PROVIDER_KEY, e.target.value); }}
                  className="w-full rounded-xl bg-zinc-800 text-zinc-100 border border-zinc-600 px-3 py-2 text-sm"
                >
                  {detectedProviders.length === 0 ? (
                    <option value="" disabled>No local LLM detected</option>
                  ) : (
                    detectedProviders.map((p) => <option key={p.name} value={p.name}>{p.name} (:{p.port})</option>)
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
                    {modelsLoading ? (
                      <option value="">Loading...</option>
                    ) : availableModels.length === 0 ? (
                      <option value="">No models found</option>
                    ) : (
                      availableModels.map((m) => <option key={m} value={m}>{m}</option>)
                    )}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <Shield className="w-5 h-5 text-indigo-400" /><h2 className="text-base font-bold text-white">Bot Diagnostics</h2>
            </div>
            {intents?.token_valid ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle className="w-4 h-4" /><span>Token valid — <strong>@{intents.username}</strong></span>
                </div>
                <div className="space-y-2 bg-black/35 rounded-xl p-4 border border-white/5">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase">Intents</h3>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-400">Server Members</span>{intents.intents.guild_members ? <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">Enabled</span> : <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Disabled</span>}</div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-400">Message Content</span>{intents.intents.message_content ? <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">Active</span> : <span className="text-xs bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-0.5 rounded-full">Inactive</span>}</div>
                </div>
                {intents.invite_url && (
                  <a href={intents.invite_url} target="_blank" rel="noopener noreferrer" className="block w-full text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold">Invite Bot to Server</a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-400 text-sm"><XCircle className="w-4 h-4" /><span>Token missing or invalid</span></div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <Key className="w-5 h-5 text-emerald-400" /><h2 className="text-base font-bold text-white">Environment</h2>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">DISCORD_TOKEN</label>
                <input type="password" value={discordToken} onChange={(e) => setDiscordToken(e.target.value)} placeholder="Bot token" className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-slate-200" />
              </div>
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Sampling Model</label>
                <input type="text" value={samplingModel} onChange={(e) => setSamplingModel(e.target.value)} placeholder="llama3.2" className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-slate-200 font-mono" />
              </div>
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Sampling Base URL</label>
                <input type="text" value={samplingBaseUrl} onChange={(e) => setSamplingBaseUrl(e.target.value)} placeholder="http://127.0.0.1:11434/v1" className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-slate-200 font-mono" />
              </div>
              <button type="submit" className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm">Apply Config</button>
              {saveSuccess && <div className="p-3 bg-emerald-500/10 text-emerald-300 rounded-xl text-xs text-center border border-emerald-500/20">Saved</div>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
