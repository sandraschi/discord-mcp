import { useEffect } from "react";
import { useServerStore } from "../store/serverStore";

/**
 * Guild picker state shared by every page that operates on a server.
 *
 * Backed by the global server store: selecting a server on the Servers page
 * updates every page that uses this hook, and vice versa. With a single
 * guild the dropdown is superfluous — `showPicker` hides it and the store
 * auto-selects.
 */
export function useGuildPicker() {
  const guilds = useServerStore((s) => s.guilds);
  const guildId = useServerStore((s) => s.selectedGuildId);
  const selectGuild = useServerStore((s) => s.selectGuild);
  const loadGuilds = useServerStore((s) => s.loadGuilds);

  useEffect(() => {
    if (guilds.length === 0) loadGuilds();
  }, [guilds.length, loadGuilds]);

  const showPicker = guilds.length > 1;

  return { guilds, guildId, setGuildId: selectGuild, showPicker };
}
