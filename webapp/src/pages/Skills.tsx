import { AlertCircle, BookMarked, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, type SkillEntry } from "@/lib/api";

export default function Skills() {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getSkills()
      .then((r) => setSkills(r.skills ?? []))
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const loadContent = async (name: string) => {
    if (expanded === name) { setExpanded(null); setContent(null); return; }
    setExpanded(name);
    setContentLoading(true);
    setContent(null);
    try {
      const r = await api.getSkillContent(name);
      setContent(r.content);
    } catch {
      setContent("Failed to load skill content.");
    } finally {
      setContentLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 max-w-4xl">
      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <BookMarked className="w-6 h-6 text-violet-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Bundled Skills</h2>
            <p className="text-sm text-slate-500">
              Exposed to MCP clients as <span className="font-mono text-slate-400">skill://name/SKILL.md</span>.
              Click a skill to expand and read the full content.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-500 text-sm py-4">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading skills…</span>
          </div>
        ) : skills.length === 0 ? (
          <p className="text-slate-500 text-sm">No skills found on the server.</p>
        ) : (
          <ul className="space-y-3">
            {skills.map((s) => (
              <li key={s.name} className="rounded-xl border border-white/5 bg-black/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => loadContent(s.name)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <span className="font-mono text-sm text-indigo-300">{s.name}</span>
                  {expanded === s.name ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                </button>
                {expanded === s.name && (
                  <div className="px-4 pb-4">
                    {contentLoading ? (
                      <p className="text-sm text-slate-500">Loading…</p>
                    ) : content ? (
                      <div className="prose prose-invert prose-sm max-w-none text-slate-300 [&_h1]:text-white [&_h2]:text-white [&_h3]:text-slate-200 [&_code]:bg-[#1a1a1e] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-indigo-300 [&_pre]:bg-[#1a1a1e] [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/5 [&_a]:text-indigo-400 [&_a]:hover:underline [&_hr]:border-white/10">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No content available.</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
