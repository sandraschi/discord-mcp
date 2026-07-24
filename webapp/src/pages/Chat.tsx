import { Bot, Download, Eraser, MessageCircle, SendHorizonal, User, Loader2, CheckCircle2, PlayCircle, ShieldAlert, Check, X, XCircle, Cpu } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type AgenticRunResponse } from "../lib/api";

const STORAGE_KEY = "discord-mcp-chat-history";
const PERSONALITY_KEY = "discord-mcp-chat-personality";

type Message = {
  role: "user" | "assistant";
  content: string;
  runId?: string;
  runData?: AgenticRunResponse | null;
};
type Personality = { id: string; label: string; prompt: string };

const HARDCODED_PERSONALITIES: Personality[] = [
  { id: "community", label: "Community Manager", prompt: "You are a Discord community management expert. Help with server organization, member engagement, channel setup, and community growth strategies." },
  { id: "moderator", label: "Moderator", prompt: "You are a Discord moderation specialist. Focus on moderation workflows, anti-spam, role management, and enforcement best practices." },
  { id: "summarizer", label: "Quick Summarizer", prompt: "You are a concise assistant. Provide brief, focused answers with bullet points." },
  { id: "custom", label: "Custom", prompt: "" },
];

const EXAMPLE_GROUPS: Record<string, string[]> = {
  Messages: [
    "List my guilds and show channels in the first one",
    "Show recent messages in a channel",
    "Send a test message to a channel",
  ],
  Moderation: [
    "List members and their roles in a guild",
    "Check recent audit log entries",
    "Show banned users in a guild",
  ],
  Server: [
    "List all guilds I manage",
    "Show guild stats and member count",
    "List available webhooks in a channel",
  ],
};

function loadHistory(): Message[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function saveHistory(messages: Message[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100))); } catch {}
}

function loadPersonality(): string {
  try { return localStorage.getItem(PERSONALITY_KEY) || "community"; } catch { return "community"; }
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [personalityId, setPersonalityId] = useState(loadPersonality);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  const [ollamaStatus, setOllamaStatus] = useState<"probing" | "online" | "offline">("probing");

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { saveHistory(messages); }, [messages]);
  useEffect(() => { localStorage.setItem(PERSONALITY_KEY, personalityId); }, [personalityId]);

  // Load skills and probe Ollama on mount
  useEffect(() => {
    api.getSkills().then((r) => {
      const names = (r.skills ?? []).map((s) => s.name);
      if (names.length > 0) {
        setActiveSkill(names[0]);
      }
    }).catch(() => {});

    api.getHealth().then((h) => {
      setOllamaStatus(h.sampling?.server_side_llm_ready ? "online" : "offline");
    }).catch(() => setOllamaStatus("offline"));
  }, []);

  const personalities = [...HARDCODED_PERSONALITIES];

  // Poll the active run
  useEffect(() => {
    if (!activeRunId) return;
    let active = true;
    const interval = setInterval(() => {
      api.getAgenticRun(activeRunId)
        .then((run) => {
          if (!active) return;
          setMessages((prev) => {
            const copy = [...prev];
            const idx = copy.findIndex((m) => m.runId === activeRunId);
            if (idx !== -1) {
              copy[idx] = { ...copy[idx], runData: run, content: run.message || run.error || (run.status === "blocked" ? "Pending user approval…" : "Executing goal steps…") };
            }
            return copy;
          });
          if (run.status === "succeeded" || run.status === "failed") {
            clearInterval(interval);
            setActiveRunId(null);
            setLoading(false);
          }
        })
        .catch(() => {});
    }, 1000);
    return () => { active = false; clearInterval(interval); };
  }, [activeRunId]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || loading) return;
    setLoading(true);
    const userText = goal.trim();
    const userMsg: Message = { role: "user", content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setGoal("");

    api.agentic(userText)
      .then((r) => {
        if (r.success && r.run_id) {
          const assistantMsg: Message = { role: "assistant", content: "Initializing planner…", runId: r.run_id, runData: null };
          setMessages((prev) => [...prev, assistantMsg]);
          setActiveRunId(r.run_id);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: `Failed: ${r.error || "Unknown error"}` }]);
          setLoading(false);
        }
      })
      .catch((e) => {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Request failed"}` }]);
        setLoading(false);
      });
  }, [goal, loading]);

  const handleApprove = (runId: string, approved: boolean) => {
    api.approveAgenticRun(runId, approved).then(() => {
      setMessages((prev) => {
        const copy = [...prev];
        const idx = copy.findIndex((m) => m.runId === runId);
        if (idx !== -1 && copy[idx].runData) {
          copy[idx] = { ...copy[idx], runData: { ...copy[idx].runData!, status: approved ? "running" : "failed", pending_tool_call: null } };
        }
        return copy;
      });
    }).catch(() => {});
  };

  const handleExport = () => {
    const lines = messages.map((m) => `[${new Date().toISOString()}] ${m.role === "user" ? "You" : "Assistant"}: ${m.content}`).join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `discord-mcp-chat-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => { setMessages([]); localStorage.removeItem(STORAGE_KEY); };

  const renderStepIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "running": return <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />;
      case "pending": return <PlayCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
      case "error": case "rejected": return <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 py-4 max-w-3xl" data-testid="chat-page">
      <div data-testid="chat-controls" className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <MessageCircle className="text-indigo-400 w-8 h-8 animate-pulse" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Agentic Control Room</h1>
            <p className="text-slate-400 text-sm">Design goals and audit the step-by-step gatekeeper live planner</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeSkill && <span className="text-[10px] text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded font-mono">skill:{activeSkill}</span>}
          <select
            data-testid="personality-select"
            value={personalityId}
            onChange={(e) => setPersonalityId(e.target.value)}
            className="bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs"
          >
            {personalities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Cpu className={`w-3.5 h-3.5 ${ollamaStatus === "online" ? "text-emerald-400" : ollamaStatus === "probing" ? "text-slate-500 animate-pulse" : "text-slate-600"}`} />
            <span className={ollamaStatus === "online" ? "text-emerald-400" : "text-slate-600"}>
              {ollamaStatus === "online" ? "Ollama" : ollamaStatus === "probing" ? "Probing…" : "Offline"}
            </span>
          </div>
          <button onClick={handleExport} disabled={messages.length === 0} data-testid="chat-export" title="Export chat" className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={handleClear} disabled={messages.length === 0} data-testid="chat-clear" title="Clear chat" className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30">
            <Eraser className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-6 bg-slate-950/20 rounded-2xl border border-white/5 p-4 min-h-[40vh] max-h-[60vh] overflow-y-auto" data-testid="chat-messages">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-sm">
            <Bot className="w-12 h-12 mb-3 text-indigo-500 opacity-40 animate-bounce" />
            <p>Welcome! Type a command below to start planning.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "assistant" ? "" : "flex-row-reverse"}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center border shrink-0 ${msg.role === "assistant" ? "bg-indigo-900/20 border-indigo-800" : "bg-slate-800 border-slate-700"}`}>
                {msg.role === "assistant" ? <Bot className="h-4 w-4 text-indigo-400" /> : <User className="h-4 w-4 text-slate-400" />}
              </div>
              <div className={`flex-1 space-y-2 ${msg.role === "assistant" ? "" : "text-right"}`}>
                <span className={`text-[10px] uppercase font-semibold ${msg.role === "assistant" ? "text-indigo-400" : "text-slate-400"}`}>
                  {msg.role === "assistant" ? "Discord Live Planner" : "You"}
                </span>
                {!msg.runId ? (
                  <div className={`text-sm p-3.5 rounded-2xl inline-block max-w-[85%] text-left whitespace-pre-wrap ${msg.role === "assistant" ? "bg-indigo-950/10 border border-indigo-900/30 text-slate-300" : "bg-slate-900/50 border border-slate-800 text-slate-200"}`}>
                    {msg.content}
                  </div>
                ) : (
                  <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 space-y-4 max-w-[90%] text-left">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs">
                      <span className="font-semibold text-slate-300">Goal Run: {msg.runId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        msg.runData?.status === "succeeded" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        msg.runData?.status === "failed" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                        msg.runData?.status === "blocked" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" :
                        "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      }`}>{msg.runData?.status ?? "Initializing"}</span>
                    </div>
                    {msg.runData && msg.runData.steps && msg.runData.steps.length > 0 && (
                      <div className="space-y-3 pl-2">
                        {msg.runData.steps.map((step, idx) => (
                          <div key={idx} className="flex gap-2 text-xs">
                            {renderStepIcon(step.status)}
                            <div className="space-y-1">
                              {step.type === "thought" ? (
                                <p className="text-slate-400 italic">{step.text}</p>
                              ) : (
                                <div>
                                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300 font-semibold">{step.name}</span>
                                  <pre className="text-[10px] text-slate-500 bg-black/25 rounded p-1.5 mt-1 font-mono break-all max-w-full overflow-x-auto">{JSON.stringify(step.arguments, null, 2)}</pre>
                                  {step.result && <div className="mt-1 bg-emerald-950/10 border border-emerald-900/20 p-2 rounded text-slate-300">{typeof step.result === "string" ? step.result : JSON.stringify(step.result)}</div>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.runData?.status === "blocked" && msg.runData.pending_tool_call && (
                      <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 uppercase tracking-wider">
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                          <span>Destructive Action Requires Approval</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          The agent requests approval for:
                          <strong className="text-amber-200 block mt-1 font-mono text-sm">
                            {msg.runData.pending_tool_call.name}({JSON.stringify(msg.runData.pending_tool_call.arguments)})
                          </strong>
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(msg.runId!, true)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors">
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button onClick={() => handleApprove(msg.runId!, false)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors">
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.runData?.status === "succeeded" && msg.runData.message && (
                      <div className="bg-emerald-950/10 border border-emerald-900/20 rounded-xl p-3 text-emerald-300 text-xs mt-2">
                        <strong>Goal Achieved:</strong> {msg.runData.message}
                      </div>
                    )}
                    {msg.runData?.status === "failed" && msg.runData.error && (
                      <div className="bg-rose-950/10 border border-rose-900/20 rounded-xl p-3 text-rose-400 text-xs mt-2">
                        <strong>Failed:</strong> {msg.runData.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-2" data-testid="example-prompts">
        {Object.entries(EXAMPLE_GROUPS).map(([group, prompts]) => (
          <div key={group} className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-slate-500 mr-1">{group}:</span>
            {prompts.map((p) => (
              <button key={p} onClick={() => setGoal(p)} className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-slate-400 hover:bg-indigo-950/30 hover:text-indigo-300 transition-colors">
                {p}
              </button>
            ))}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="goal" className="block text-slate-300 text-sm font-medium mb-2">Design natural language goal</label>
          <div className="relative">
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder='e.g. "List members in server, search RAG for support issues, then kick member 123"'
              rows={3}
              className="w-full rounded-xl bg-black/40 border border-white/10 pl-4 pr-12 py-3 text-slate-200 resize-y focus:outline-none focus:border-indigo-500/50"
              data-testid="chat-input"
            />
            <button
              type="submit"
              disabled={loading || !goal.trim()}
              className="absolute right-3 bottom-4 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20"
              data-testid="chat-send"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
