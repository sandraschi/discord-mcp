import type { Guild } from "./api";

export interface ServerInfo {
  description: string;
  tags: string[];
  home?: string;
  /** Personal server (user-owned) — shown under "My servers" even though the bot isn't the owner. */
  mine?: boolean;
}

/**
 * Curated catalog for well-known servers the bot may be a member of.
 * Matching is name-based (ids are only known at runtime). Anything not
 * matched falls back to a generic entry.
 */
const KNOWN: Array<{
  match: string[];
  description: string;
  tags: string[];
  home?: string;
  mine?: boolean;
}> = [
  {
    match: ["opencode"],
    description:
      "Official OpenCode community — agentic coding tooling, releases and discussion.",
    tags: ["dev", "ai"],
    home: "https://opencode.ai",
  },
  {
    match: ["ollama"],
    description:
      "Ollama community — local LLM runtime, models and self-hosted inference.",
    tags: ["llm", "local"],
    home: "https://ollama.com",
  },
  {
    match: ["lm studio", "lmstudio"],
    description:
      "LM Studio community — local model playground and OpenAI-compatible server.",
    tags: ["llm", "local"],
    home: "https://lmstudio.ai",
  },
  {
    match: ["cursor"],
    description: "Cursor editor community — AI-native IDE, agents and updates.",
    tags: ["dev", "ai"],
    home: "https://cursor.com",
  },
  {
    match: ["discord"],
    description:
      "Discord developer community — API, bots and platform updates.",
    tags: ["dev", "discord"],
    home: "https://discord.com/developers",
  },
  {
    match: ["sandra's fleet", "fleet hq", "sandraschi"],
    description: "Your fleet server — full administrative control.",
    tags: ["fleet", "mine"],
    mine: true,
  },
];

export function guildInfo(g: Guild): ServerInfo {
  const lower = g.name.toLowerCase();
  for (const k of KNOWN) {
    if (k.match.some((m) => lower.includes(m))) {
      return {
        description: k.description,
        tags: k.tags,
        home: k.home,
        mine: k.mine,
      };
    }
  }
  return { description: "No description available.", tags: [] };
}

export function guildCategory(g: Guild): "mine" | "following" {
  return g.owner || guildInfo(g).mine ? "mine" : "following";
}
