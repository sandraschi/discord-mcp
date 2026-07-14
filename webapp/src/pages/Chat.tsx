import { AlertCircle, Bot, Download, Eraser, MessageCircle, SendHorizonal, User, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

const STORAGE_KEY = "discord-mcp-chat-history";
const PERSONALITY_KEY = "discord-mcp-chat-personality";

type Message = { role: "user" | "assistant"; content: string };
type Personality = { id: string; label: string; prompt: string };

const PERSONALITIES: Personality[] = [
  { id: "community", label: "Community Manager", prompt: "You are a Discord community management expert. Help with server organization, member engagement, channel setup, and community growth strategies." },
  { id: "moderator", label: "Moderator", prompt: "You are a Discord moderation specialist. Focus on moderation workflows, anti-spam, role management, and enforcement best practices." },
  { id: "summarizer", label: "Quick Summarizer", prompt: "You are a concise assistant. Provide brief, focused answers with bullet points." },
  { id: "custom", label: "Custom", prompt: "" },
];

const EXAMPLE_GROUPS: Record<string, string[]> = {
  "Messages": [
    "List my guilds and show channels in the first one",
    "Show recent messages in a channel",
    "Send a test message to a channel",
  ],
  "Moderation": [
    "List members and their roles in a guild",
    "Check recent audit log entries",
    "Show banned users in a guild",
  ],
  "Server": [
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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => { saveHistory(messages); }, [messages]);

  useEffect(() => { localStorage.setItem(PERSONALITY_KEY, personalityId); }, [personalityId]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || loading) return;
    setLoading(true);
    const userText = goal.trim();
    const userMsg: Message = { role: "user", content: userText };
    setMessages(prev => [...prev, userMsg]);
    setGoal("");
    api
      .agentic(userText)
      .then((r) => {
        const ops = r.available_operations?.join(", ") ?? "";
        const reply = r.message
          ? `${r.message}\n\nAvailable operations: ${ops}`
          : `No response. Available operations: ${ops}`;
        setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      })
      .catch((e) => {
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Request failed"}` }]);
      })
      .finally(() => setLoading(false));
  }, [goal, loading]);

  const handleExport = () => {
    const lines = messages.map(m => {
      const ts = new Date().toISOString();
      return `[${ts}] ${m.role === "user" ? "You" : "Assistant"}: ${m.content}`;
    }).join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `discord-mcp-chat-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="space-y-6 py-4 max-w-3xl" data-testid="chat-page">
      <div data-testid="chat-controls" className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <MessageCircle className="text-indigo-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Agentic Chat</h1>
            <p className="text-slate-400 text-sm">Describe a Discord task — the agent will help you execute it</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded font-medium">skill:discord-manager</span>
          <select
            data-testid="personality-select"
            value={personalityId}
            onChange={e => setPersonalityId(e.target.value)}
            className="bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs"
          >
            {PERSONALITIES.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button onClick={handleExport} disabled={messages.length === 0} data-testid="chat-export" title="Export chat" className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={handleClear} disabled={messages.length === 0} data-testid="chat-clear" title="Clear chat" className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30">
            <Eraser className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4" data-testid="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "assistant" ? "" : "flex-row-reverse"}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center border shrink-0 ${msg.role === "assistant" ? "bg-indigo-900/20 border-indigo-800" : "bg-slate-800 border-slate-700"}`}>
              {msg.role === "assistant" ? <Bot className="h-4 w-4 text-indigo-400" /> : <User className="h-4 w-4 text-slate-400" />}
            </div>
            <div className={`flex-1 space-y-1 ${msg.role === "assistant" ? "" : "text-right"}`}>
              <span className={`text-xs ${msg.role === "assistant" ? "text-indigo-400" : "text-slate-200"}`}>
                {msg.role === "assistant" ? "Discord Agent" : "You"}
              </span>
              <div className={`text-sm p-3 rounded-md inline-block max-w-[80%] text-left whitespace-pre-wrap ${msg.role === "assistant" ? "bg-indigo-950/10 border border-indigo-900/30 text-slate-300" : "bg-slate-900/50 border border-slate-800 text-slate-200"}`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-indigo-900/20 flex items-center justify-center border border-indigo-800">
              <Bot className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Example prompts */}
      <div className="flex flex-wrap gap-2" data-testid="example-prompts">
        {Object.entries(EXAMPLE_GROUPS).map(([group, prompts]) => (
          <div key={group} className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-slate-500 mr-1">{group}:</span>
            {prompts.map(p => (
              <button
                key={p}
                onClick={() => { setGoal(p); }}
                className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-slate-400 hover:bg-indigo-950/30 hover:text-indigo-300 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Error */}
      {messages.filter(m => m.role === "assistant" && m.content.startsWith("Error:")).length > 0 && messages[messages.length - 1]?.content.startsWith("Error:") && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{messages[messages.length - 1].content}</p>
        </div>
      )}

      {/* Agentic form — single goal */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="goal" className="block text-slate-300 text-sm font-medium mb-2">What do you want to do on Discord?</label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder='e.g. "List my guilds and show the channels in the first one"'
            rows={3}
            className="w-full rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-3 text-slate-200 resize-y"
            data-testid="chat-input"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !goal.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
            data-testid="chat-send"
          >
            <SendHorizonal className="w-4 h-4" />
            {loading ? "Thinking..." : "Send goal"}
          </button>
        </div>
      </form>
    </div>
  );
}
