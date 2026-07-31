import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderOpen,
  Hash,
  Megaphone,
  MessagesSquare,
  Network,
  RefreshCw,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, type Channel, type Thread } from "../lib/api";
import { useGuildPicker } from "../lib/useGuildPicker";

interface TreeNode {
  channel: Channel;
  children: TreeNode[];
  threads: Thread[];
}

const TYPE_ICON: Record<number, typeof Hash> = {
  0: Hash,
  2: Volume2,
  4: FolderOpen,
  5: Megaphone,
  15: MessagesSquare,
};

const TYPE_LABEL: Record<number, string> = {
  0: "text",
  2: "voice",
  4: "category",
  5: "announcement",
  15: "forum",
};

function buildTree(channels: Channel[], threadsByChannel: Map<string, Thread[]>): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const c of channels) {
    nodes.set(c.id, { channel: c, children: [], threads: threadsByChannel.get(c.id) ?? [] });
  }
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.channel.parent_id ? nodes.get(node.channel.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Render the tree as ASCII box-drawing text (copyable). */
function toAscii(roots: TreeNode[]): string {
  const lines: string[] = [];
  const walk = (node: TreeNode, prefix: string, isLast: boolean) => {
    const icon = TYPE_LABEL[node.channel.type] ?? `type-${node.channel.type}`;
    lines.push(`${prefix}${isLast ? "└── " : "├── "}#${node.channel.name} (${icon})`);
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    const kids = node.children;
    kids.forEach((child, i) => walk(child, childPrefix, i === kids.length - 1));
    node.threads.forEach((t, i) => {
      const last = i === node.threads.length - 1;
      lines.push(`${childPrefix}${last ? "└── " : "├── "}💬 ${t.name}`);
    });
  };
  roots.forEach((root, i) => walk(root, "", i === roots.length - 1));
  return lines.join("\n");
}

function countChannels(roots: TreeNode[]): number {
  let n = 0;
  for (const r of roots) {
    n += 1 + r.children.length + r.threads.length;
    for (const c of r.children) n += c.threads.length;
  }
  return n;
}

export default function ServerTree() {
  const { guilds, guildId, setGuildId, showPicker } = useGuildPicker();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [threadsByChannel, setThreadsByChannel] = useState<Map<string, Thread[]>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [asciiView, setAsciiView] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!guildId) {
      setChannels([]);
      return;
    }
    setLoading(true);
    setErr(null);
    api
      .getChannels(guildId)
      .then(async (r) => {
        const list = r.channels ?? [];
        setChannels(list);
        // fetch active threads for every text/announcement channel in parallel
        const textChannels = list.filter((c) => c.type === 0 || c.type === 5);
        const results = await Promise.all(
          textChannels.map(async (c) => {
            try {
              const tr = await api.getChannelThreads(c.id);
              return [c.id, tr.threads ?? []] as const;
            } catch {
              return [c.id, [] as Thread[]] as const;
            }
          }),
        );
        setThreadsByChannel(new Map(results));
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  const roots = buildTree(channels, threadsByChannel);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyAscii = async () => {
    try {
      await navigator.clipboard.writeText(toAscii(roots));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const Icon = TYPE_ICON[node.channel.type] ?? Hash;
    const hasChildren = node.children.length > 0 || node.threads.length > 0;
    const isCollapsed = collapsed.has(node.channel.id);
    return (
      <div key={node.channel.id}>
        <div
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors ${
            node.channel.type === 4 ? "mt-1 font-semibold" : ""
          }`}
          style={{ marginLeft: depth * 20 }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggle(node.channel.id)}
              className="text-slate-400 hover:text-white shrink-0"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <Icon
            className={`h-4 w-4 shrink-0 ${
              node.channel.type === 4
                ? "text-amber-400"
                : node.channel.type === 2
                  ? "text-sky-400"
                  : "text-slate-400"
            }`}
          />
          <span className="text-sm text-slate-200">#{node.channel.name}</span>
          {node.threads.length > 0 && (
            <span className="text-xs text-slate-500">
              {node.threads.length} thread{node.threads.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {!isCollapsed && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
            {node.threads.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                style={{ marginLeft: (depth + 1) * 20 + 24 }}
              >
                <MessagesSquare className="h-3.5 w-3.5 text-emerald-400/80 shrink-0" />
                <span className="text-sm text-slate-300">{t.name}</span>
                {typeof t.message_count === "number" && (
                  <span className="text-xs text-slate-500">{t.message_count} msgs</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 py-4 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Network className="text-amber-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white">Server tree</h1>
            <p className="text-slate-400 text-sm">
              {roots.length > 0
                ? `${countChannels(roots)} nodes across ${roots.length} root branch${roots.length !== 1 ? "es" : ""}`
                : "Category and channel hierarchy with active threads"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {roots.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setAsciiView((v) => !v)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                {asciiView ? "Styled view" : "ASCII view"}
              </button>
              {asciiView && (
                <button
                  type="button"
                  onClick={copyAscii}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 inline-flex items-center gap-2"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading || !guildId}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 inline-flex items-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      {showPicker && (
        <select
          value={guildId}
          onChange={(e) => setGuildId(e.target.value)}
          className="rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-2 text-slate-200 min-w-[200px]"
        >
          <option value="">Select server</option>
          {guilds.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}

      {loading && <p className="text-slate-400">Loading server structure…</p>}

      {!loading && guildId && roots.length === 0 && !err && (
        <p className="text-slate-500 text-center py-8">No channels or no permission.</p>
      )}

      {!loading && roots.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-4">
          {asciiView ? (
            <pre className="text-sm text-slate-300 font-mono leading-relaxed overflow-x-auto">
              {toAscii(roots)}
            </pre>
          ) : (
            <div className="space-y-0.5">{roots.map((node) => renderNode(node, 0))}</div>
          )}
        </div>
      )}
    </div>
  );
}
