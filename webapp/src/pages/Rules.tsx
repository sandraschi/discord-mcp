import { AlertCircle, Cpu, Plus, Trash2, ToggleLeft, ToggleRight, Info, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type AutomationRule } from "../lib/api";

export default function Rules() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New Rule form state
  const [name, setName] = useState("");
  const [conditionType, setConditionType] = useState("contains");
  const [conditionValue, setConditionValue] = useState("");
  const [actionType, setActionType] = useState("reply");
  const [actionValue, setActionValue] = useState("");

  const loadRules = () => {
    setLoading(true);
    setErr(null);
    api.getRules()
      .then((data) => setRules(data || []))
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load rules"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newRule: AutomationRule = {
      id: `rule_${Math.random().toString(36).substring(2, 11)}`,
      name: name.trim(),
      trigger: "on_message",
      condition_type: conditionType,
      condition_value: conditionValue.trim(),
      action_type: actionType,
      action_value: actionValue.trim(),
      active: true
    };

    const updated = [...rules, newRule];
    saveRulesPayload(updated);

    // Reset form
    setName("");
    setConditionValue("");
    setActionValue("");
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    saveRulesPayload(updated);
  };

  const handleToggleRule = (id: string) => {
    const updated = rules.map(r => r.id === id ? { ...r, active: !r.active } : r);
    saveRulesPayload(updated);
  };

  const saveRulesPayload = (payload: AutomationRule[]) => {
    setIsSaving(true);
    api.saveRules(payload)
      .then(() => {
        setRules(payload);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to save rules"))
      .finally(() => setIsSaving(false));
  };

  return (
    <div className="space-y-8 py-4 max-w-5xl" data-testid="rules-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Cpu className="text-indigo-400 w-8 h-8 animate-pulse" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Automation Rules</h1>
            <p className="text-slate-400 text-sm">
              Define event-driven actions triggered automatically by Discord watcher activities.
            </p>
          </div>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{err}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Rules Canvas List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h2 className="text-base font-bold text-white">Active Rules Canvas</h2>
              {isSaving && <span className="text-xs text-indigo-400 animate-pulse">Saving canvas…</span>}
            </div>

            {loading ? (
              <div className="text-xs text-slate-500 py-6 text-center">Loading rules…</div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm text-center">
                <Info className="w-8 h-8 mb-2 opacity-30" />
                <p>No automation rules configured yet.</p>
                <p className="text-xs text-slate-600 mt-1">Use the panel on the right to build your first rule.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`rounded-xl border p-4 transition-all ${
                      rule.active 
                        ? "bg-black/35 border-white/10" 
                        : "bg-black/10 border-white/5 opacity-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{rule.name}</span>
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono font-medium">
                            {rule.trigger}
                          </span>
                        </div>
                        
                        {/* Visual Logic Flow Representation */}
                        <div className="flex items-center gap-2 text-xs flex-wrap font-sans text-slate-400">
                          <span>IF message</span>
                          <strong className="text-slate-300 font-semibold">{rule.condition_type}</strong>
                          <code className="bg-slate-800/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-indigo-300">"{rule.condition_value}"</code>
                          <span>THEN execute</span>
                          <strong className="text-indigo-400 font-semibold">{rule.action_type}</strong>
                          <code className="bg-slate-800/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-emerald-300">"{rule.action_value}"</code>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          title={rule.active ? "Deactivate Rule" : "Activate Rule"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            rule.active ? "text-indigo-400 hover:text-indigo-300" : "text-slate-600 hover:text-slate-500"
                          }`}
                        >
                          {rule.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Delete Rule"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Create Rule Form */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Rule Constructor</h2>
            </div>

            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Help Auto Responder"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Trigger Event</label>
                <select className="w-full rounded-xl bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-slate-400 focus:outline-none">
                  <option value="on_message">On Message Received</option>
                </select>
              </div>

              {/* Condition Section */}
              <div className="space-y-2 border border-white/5 rounded-xl p-3 bg-black/20">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Condition (IF)</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">Check Type</label>
                    <select
                      value={conditionType}
                      onChange={(e) => setConditionType(e.target.value)}
                      className="w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="contains">Content Contains</option>
                      <option value="author">Author Username</option>
                      <option value="channel">Channel ID</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">Value Matches</label>
                    <input
                      type="text"
                      placeholder="Match term"
                      value={conditionValue}
                      onChange={(e) => setConditionValue(e.target.value)}
                      className="w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-1.5 text-xs text-slate-200"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Action Section */}
              <div className="space-y-2 border border-white/5 rounded-xl p-3 bg-black/20">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Action (THEN)</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">Execute Action</label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="reply">Send Reply Msg</option>
                      <option value="assign_role">Assign Role</option>
                      <option value="webhook">Trigger Webhook</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">Action Value</label>
                    <input
                      type="text"
                      placeholder={actionType === "reply" ? "Message text" : actionType === "webhook" ? "http://..." : "role_id"}
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                      className="w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-1.5 text-xs text-slate-200"
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add Rule to Canvas
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
