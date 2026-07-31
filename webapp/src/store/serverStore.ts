import { create } from "zustand";
import { api, type Guild } from "../lib/api";

const STORAGE_KEY = "discord-mcp-selected-guild";

function readSavedGuild(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

interface ServerState {
  guilds: Guild[];
  selectedGuildId: string;
  loading: boolean;
  error: string | null;
  setGuilds: (guilds: Guild[]) => void;
  /** Select a server globally — every page with a picker follows. */
  selectGuild: (id: string) => void;
  loadGuilds: () => Promise<void>;
}

export const useServerStore = create<ServerState>((set, get) => ({
  guilds: [],
  selectedGuildId: readSavedGuild(),
  loading: false,
  error: null,

  setGuilds: (guilds) => set({ guilds }),

  selectGuild: (id) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable */
    }
    set({ selectedGuildId: id });
  },

  loadGuilds: async () => {
    set({ loading: true, error: null });
    try {
      const r = await api.getGuilds();
      const list = r.guilds ?? [];
      set({ guilds: list, loading: false });
      const saved = get().selectedGuildId;
      if (list.length === 1) {
        // single server — auto-select, dropdowns disappear everywhere
        if (get().selectedGuildId !== list[0].id) get().selectGuild(list[0].id);
      } else if (saved && !list.some((g) => g.id === saved)) {
        // saved server no longer reachable — clear selection
        get().selectGuild("");
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
}));
