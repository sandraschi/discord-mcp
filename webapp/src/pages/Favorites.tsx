import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Star, Hash, Server, Trash2 } from 'lucide-react'
import {
  getFavorites,
  removeGuild,
  removeChannel,
  type FavoriteGuild,
  type FavoriteChannel,
} from '../lib/favorites'

export default function Favorites() {
  const [guilds, setGuilds] = useState<FavoriteGuild[]>([])
  const [channels, setChannels] = useState<FavoriteChannel[]>([])
  const navigate = useNavigate()

  const refresh = () => {
    const f = getFavorites()
    setGuilds(f.guilds)
    setChannels(f.channels)
  }

  useEffect(() => refresh(), [])

  const handleRemoveGuild = (id: string) => {
    removeGuild(id)
    refresh()
  }
  const handleRemoveChannel = (id: string) => {
    removeChannel(id)
    refresh()
  }

  return (
    <div className="space-y-8 py-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <Star className="text-amber-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Favorites</h1>
          <p className="text-slate-400 text-sm">Quick access and trawl targets (e.g. LM Studio, release channels)</p>
        </div>
      </div>

      {guilds.length === 0 && channels.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-8 text-center text-slate-500">
          <p>No favorites yet. Add guilds from the Guilds page and channels from the Channels page using the star.</p>
          <Link to="/guilds" className="mt-4 inline-block text-indigo-400 hover:underline">
            Go to Guilds
          </Link>
        </div>
      )}

      {guilds.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Server className="w-4 h-4" /> Favorite servers ({guilds.length})
          </h2>
          <ul className="space-y-2">
            {guilds.map((g) => (
              <li
                key={g.id}
                className="rounded-xl border border-white/10 bg-[#0f0f12]/80 p-4 flex items-center justify-between"
              >
                <button
                  type="button"
                  onClick={() => navigate('/channels', { state: { guildId: g.id } })}
                  className="text-left flex-1 font-medium text-slate-200 hover:text-indigo-400"
                >
                  {g.name}
                </button>
                <span className="text-slate-500 font-mono text-xs mr-4">{g.id}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveGuild(g.id)}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/5"
                  title="Remove from favorites"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {channels.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4" /> Favorite channels ({channels.length})
          </h2>
          <ul className="space-y-2">
            {channels.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-white/10 bg-[#0f0f12]/80 p-4 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate('/messages', { state: { channelId: c.id } })}
                    className="font-medium text-slate-200 hover:text-indigo-400 block truncate"
                  >
                    #{c.name}
                  </button>
                  <p className="text-slate-500 text-sm truncate">{c.guildName}</p>
                </div>
                <span className="text-slate-500 font-mono text-xs mr-4 shrink-0">{c.id}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveChannel(c.id)}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/5 shrink-0"
                  title="Remove from favorites"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
