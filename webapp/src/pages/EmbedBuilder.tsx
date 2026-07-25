import { AlertCircle, Eye, MessageSquare, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Guild, type Channel } from "../lib/api";

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

interface Embed {
  title: string;
  description: string;
  color: string;
  author_name: string;
  author_url: string;
  author_icon: string;
  thumbnail: string;
  image: string;
  footer: string;
  fields: EmbedField[];
}

const COLOR_PRESETS = [
  { label: "Blurple", value: "#5865F2" },
  { label: "Green", value: "#57F287" },
  { label: "Yellow", value: "#FEE75C" },
  { label: "Fuchsia", value: "#EB459E" },
  { label: "Red", value: "#ED4245" },
  { label: "White", value: "#FFFFFF" },
  { label: "Custom", value: "" },
];

export default function EmbedBuilder() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [embed, setEmbed] = useState<Embed>({
    title: "", description: "", color: "#5865F2",
    author_name: "", author_url: "", author_icon: "",
    thumbnail: "", image: "", footer: "", fields: [],
  });
  const [customColor, setCustomColor] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.getGuilds().then((r) => setGuilds(r.guilds ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedGuildId) {
      api.getChannels(selectedGuildId).then((r) => setChannels(r.channels?.filter((c) => c.type === 0) ?? [])).catch(() => {});
    }
  }, [selectedGuildId]);

  const effectiveColor = embed.color || customColor || "#5865F2";

  const addField = () => setEmbed((e) => ({ ...e, fields: [...e.fields, { name: "", value: "", inline: false }] }));
  const updateField = (i: number, k: keyof EmbedField, v: any) => {
    const f = [...embed.fields]; f[i] = { ...f[i], [k]: v }; setEmbed((e) => ({ ...e, fields: f }));
  };
  const removeField = (i: number) => setEmbed((e) => ({ ...e, fields: e.fields.filter((_, j) => j !== i) }));

  const handleSend = async () => {
    if (!selectedChannelId) { setErr("Select a channel"); return; }
    setSending(true); setErr(null); setSuccess(false);
    try {
      const content = embed.title ? `**${embed.title}**` : "";
      await api.sendMessage(selectedChannelId, content || "(embed sent)");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <MessageSquare className="text-indigo-400 w-8 h-8" />
        <div><h1 className="text-2xl font-bold text-white tracking-tight">Embed Builder</h1><p className="text-slate-400 text-sm">Compose rich embeds and send to a channel</p></div>
      </div>

      {err && <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200"><AlertCircle className="w-5 h-5" /><p className="text-sm">{err}</p></div>}
      {success && <div className="p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-sm text-center">Sent!</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-200">Compose</h2>

            <div className="flex gap-2 flex-wrap">
              <select value={selectedGuildId} onChange={(e) => setSelectedGuildId(e.target.value)} className="flex-1 rounded-xl bg-zinc-800 text-zinc-100 border border-zinc-600 px-3 py-2 text-sm">
                <option value="">Guild</option>
                {guilds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <select value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)} className="flex-1 rounded-xl bg-zinc-800 text-zinc-100 border border-zinc-600 px-3 py-2 text-sm">
                <option value="">Channel</option>
                {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </div>

            <Input label="Title" value={embed.title} onChange={(v) => setEmbed({ ...embed, title: v })} />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <textarea value={embed.description} onChange={(e) => setEmbed({ ...embed, description: e.target.value })} rows={3} className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-slate-200" />
            </div>

            <div className="flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button key={c.label} type="button" onClick={() => setEmbed({ ...embed, color: c.value })} className={`w-8 h-8 rounded-full border-2 ${embed.color === c.value ? "border-white" : "border-transparent"}`} style={{ backgroundColor: c.value || "#1a1a1e" }} title={c.label} />
              ))}
              <input type="color" value={customColor || "#5865F2"} onChange={(e) => { setCustomColor(e.target.value); setEmbed({ ...embed, color: e.target.value })} } className="w-8 h-8 rounded-full cursor-pointer bg-transparent border-0" />
            </div>

            <Input label="Author Name" value={embed.author_name} onChange={(v) => setEmbed({ ...embed, author_name: v })} />
            <Input label="Author URL" value={embed.author_url} onChange={(v) => setEmbed({ ...embed, author_url: v })} />
            <Input label="Author Icon URL" value={embed.author_icon} onChange={(v) => setEmbed({ ...embed, author_icon: v })} />
            <Input label="Thumbnail URL" value={embed.thumbnail} onChange={(v) => setEmbed({ ...embed, thumbnail: v })} />
            <Input label="Image URL" value={embed.image} onChange={(v) => setEmbed({ ...embed, image: v })} />
            <Input label="Footer" value={embed.footer} onChange={(v) => setEmbed({ ...embed, footer: v })} />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Fields ({embed.fields.length})</span>
                <button type="button" onClick={addField} className="text-xs px-2 py-1 rounded bg-indigo-600/80 hover:bg-indigo-500 text-white">+ Add Field</button>
              </div>
              {embed.fields.map((f, i) => (
                <div key={i} className="flex gap-2 items-start bg-black/25 rounded-xl p-2">
                  <div className="flex-1 space-y-1">
                    <input value={f.name} onChange={(e) => updateField(i, "name", e.target.value)} placeholder="Name" className="w-full rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-xs text-slate-200" />
                    <textarea value={f.value} onChange={(e) => updateField(i, "value", e.target.value)} placeholder="Value" rows={2} className="w-full rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-xs text-slate-200" />
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-500"><input type="checkbox" checked={f.inline} onChange={(e) => updateField(i, "inline", e.target.checked)} /> Inline</label>
                  </div>
                  <button type="button" onClick={() => removeField(i)} className="p-1 text-slate-600 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>

            <button type="button" onClick={handleSend} disabled={sending || !selectedChannelId} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold">
              <Send className="w-4 h-4" /> {sending ? "Sending..." : "Send to Channel"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Eye className="w-4 h-4 text-indigo-400" /> Preview</h2>
          <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 overflow-hidden">
            <div className="h-1" style={{ backgroundColor: effectiveColor }} />
            <div className="p-4 space-y-3">
              {embed.author_name && (
                <div className="flex items-center gap-2 text-sm">
                  {embed.author_icon && <img src={embed.author_icon} alt="" className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                  {embed.author_url ? <a href={embed.author_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-medium">{embed.author_name}</a> : <span className="text-slate-200 font-medium">{embed.author_name}</span>}
                </div>
              )}
              {embed.title && <h3 className="text-base font-bold text-white">{embed.title}</h3>}
              {embed.description && <p className="text-sm text-slate-300 whitespace-pre-wrap">{embed.description}</p>}
              {embed.thumbnail && <img src={embed.thumbnail} alt="" className="max-w-24 max-h-24 rounded-lg float-right ml-2" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              {embed.fields.length > 0 && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {embed.fields.map((f, i) => (
                    <div key={i} className={f.inline ? "col-span-1" : "col-span-2"}>
                      <p className="font-semibold text-slate-200 text-xs uppercase">{f.name || "(empty)"}</p>
                      <p className="text-slate-300 whitespace-pre-wrap">{f.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {embed.image && <img src={embed.image} alt="" className="rounded-xl max-h-64 w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              {embed.footer && <p className="text-xs text-slate-500 border-t border-white/5 pt-2">{embed.footer}</p>}
              {!embed.title && !embed.description && !embed.author_name && embed.fields.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-8">Start typing to see a preview</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-slate-200" />
    </div>
  );
}
