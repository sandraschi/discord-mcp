import { AlertCircle, Cpu, MessageCircle, SendHorizonal } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";

export default function Chat() {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    api
      .agentic(goal.trim())
      .then((r) => {
        const ops = r.available_operations?.join(", ") ?? "";
        setResult(
          r.message
            ? `${r.message}\n\nAvailable operations: ${ops}`
            : `No response. Available operations: ${ops}`,
        );
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Request failed"))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-6 py-4 max-w-3xl">
      <div className="flex items-center gap-4">
        <MessageCircle className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Agentic Chat
          </h1>
          <p className="text-slate-400 text-sm">
            Describe a Discord task — the agent will help you execute it
          </p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="goal"
            className="block text-slate-300 text-sm font-medium mb-2"
          >
            What do you want to do on Discord?
          </label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder='e.g. "List my guilds and show the channels in the first one"'
            rows={3}
            className="w-full rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-3 text-slate-200 resize-y"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !goal.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
        >
          <SendHorizonal className="w-4 h-4" />
          {loading ? "Thinking…" : "Send goal"}
        </button>
      </form>

      {result && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400">
            <Cpu className="w-5 h-5" />
            <h2 className="text-sm font-bold text-slate-200">Agent response</h2>
          </div>
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
