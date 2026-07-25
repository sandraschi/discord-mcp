import { AlertCircle, BarChart3, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type AnalyticsStatsResponse } from "../lib/api";

export default function Stats() {
  const [data, setData] = useState<AnalyticsStatsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getAnalyticsStats()
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BarChart3 className="text-indigo-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Analytics</h1>
            <p className="text-slate-400 text-sm">API usage, errors, latency, message volume</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-300 text-sm disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5" /><p className="text-sm">{err}</p>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="API Calls" value={data.api_calls_count.toLocaleString()} color="text-indigo-400" />
            <StatCard label="Avg Latency" value={`${data.avg_latency_ms.toFixed(1)}ms`} color="text-emerald-400" />
            <StatCard label="Rate Limits" value={data.rate_limits} color={data.rate_limits > 0 ? "text-amber-400" : "text-slate-400"} />
            <StatCard label="Errors" value={data.errors_count} color={data.errors_count > 0 ? "text-rose-400" : "text-slate-400"} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-4">Message Volume (24h)</h2>
            {data.message_volume && data.message_volume.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.message_volume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a1e", border: "1px solid #ffffff20", borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="messages" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm text-center py-8">No message volume data yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
