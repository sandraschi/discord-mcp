import { AlertCircle, Check, ExternalLink, RefreshCw, Server, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Guild } from "../lib/api";
import { addGuild, getFavorites, removeGuild } from "../lib/favorites";
import { guildCategory, guildInfo } from "../lib/guildCatalog";
import { useServerStore } from "../store/serverStore";

function GuildCard({
  guild,
  selected,
  onSelect,
}: {
  guild: Guild;
  selected: boolean;
  onSelect: () => void;
}) {
  const info = guildInfo(guild);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(getFavorites().guilds.map((g) => g.id)),
  );
  const isFavorite = favoriteIds.has(guild.id);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavorite) removeGuild(guild.id);
    else addGuild({ id: guild.id, name: guild.name });
    setFavoriteIds(new Set(getFavorites().guilds.map((x) => x.id)));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`w-full text-left rounded-2xl border p-4 transition-colors cursor-pointer ${
        selected
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-white/10 bg-[#0f0f12]/80 hover:border-white/25 hover:bg-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-slate-200">
              {guild.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white truncate">{guild.name}</h3>
              {selected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <Check className="h-3 w-3" /> Current
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 line-clamp-2 mt-0.5">
              {info.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {info.home && (
            <a
              href={info.home}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg text-slate-500 hover:bg-white/10 hover:text-slate-200"
              title="Open website"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={toggleFavorite}
            className="p-2 rounded-lg text-slate-500 hover:bg-white/10 hover:text-amber-400"
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      {info.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {info.tags.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-full text-xs text-slate-400 border border-white/10 bg-white/5"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Guilds() {
  const navigate = useNavigate();
  const guilds = useServerStore((s) => s.guilds);
  const selectedGuildId = useServerStore((s) => s.selectedGuildId);
  const selectGuild = useServerStore((s) => s.selectGuild);
  const loadGuilds = useServerStore((s) => s.loadGuilds);
  const loading = useServerStore((s) => s.loading);
  const err = useServerStore((s) => s.error);

  useEffect(() => {
    if (guilds.length === 0 && !loading) loadGuilds();
  }, [guilds.length, loading, loadGuilds]);

  const mine = guilds.filter((g) => guildCategory(g) === "mine");
  const following = guilds.filter((g) => guildCategory(g) === "following");

  const handleSelect = (g: Guild) => {
    selectGuild(g.id);
    navigate("/channels");
  };

  const renderSection = (title: string, list: Guild[]) => (
    <div>
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
        {title} <span className="text-slate-500">({list.length})</span>
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((g) => (
          <GuildCard
            key={g.id}
            guild={g}
            selected={g.id === selectedGuildId}
            onSelect={() => handleSelect(g)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 py-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Server className="text-amber-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Servers</h1>
            <p className="text-slate-400 text-sm">
              {guilds.length} server{guilds.length !== 1 ? "s" : ""} — select one and every page follows
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadGuilds}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      {guilds.length === 0 && !err && (
        <p className="text-slate-500 text-center py-8">
          {loading ? "Loading servers…" : "No servers — add the bot to a server first."}
        </p>
      )}

      {mine.length > 0 && renderSection("My servers", mine)}
      {following.length > 0 && renderSection("Following", following)}
    </div>
  );
}
