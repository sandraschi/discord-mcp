const STORAGE_KEY = "discord-mcp-favorites";

export interface FavoriteGuild {
  id: string;
  name: string;
}

export interface FavoriteChannel {
  id: string;
  guildId: string;
  name: string;
  guildName: string;
}

export interface Favorites {
  guilds: FavoriteGuild[];
  channels: FavoriteChannel[];
}

function read(): Favorites {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { guilds: [], channels: [] };
    const parsed = JSON.parse(raw) as Favorites;
    return {
      guilds: Array.isArray(parsed.guilds) ? parsed.guilds : [],
      channels: Array.isArray(parsed.channels) ? parsed.channels : [],
    };
  } catch {
    return { guilds: [], channels: [] };
  }
}

function write(f: Favorites): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
}

export function getFavorites(): Favorites {
  return read();
}

export function addGuild(guild: FavoriteGuild): void {
  const f = read();
  if (f.guilds.some((x) => x.id === guild.id)) return;
  f.guilds.push(guild);
  write(f);
}

export function removeGuild(guildId: string): void {
  const f = read();
  f.guilds = f.guilds.filter((x) => x.id !== guildId);
  f.channels = f.channels.filter((x) => x.guildId !== guildId);
  write(f);
}

export function addChannel(channel: FavoriteChannel): void {
  const f = read();
  if (f.channels.some((x) => x.id === channel.id)) return;
  f.channels.push(channel);
  write(f);
}

export function removeChannel(channelId: string): void {
  const f = read();
  f.channels = f.channels.filter((x) => x.id !== channelId);
  write(f);
}

export function isGuildFavorite(guildId: string): boolean {
  return read().guilds.some((x) => x.id === guildId);
}

export function isChannelFavorite(channelId: string): boolean {
  return read().channels.some((x) => x.id === channelId);
}
