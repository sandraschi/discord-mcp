import { Settings as SettingsIcon } from 'lucide-react'

export default function Settings() {
  return (
    <div className="space-y-6 py-4 max-w-4xl">
      <div className="flex items-center gap-4">
        <SettingsIcon className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-slate-400 text-sm">Configure Discord MCP</p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5">
        <h2 className="text-sm font-bold text-slate-200 mb-2">DISCORD_TOKEN</h2>
        <p className="text-slate-400 text-sm">
          Set in environment or .env (not stored in browser). Create a bot at Discord Developer Portal and invite it to your server.
        </p>
      </div>
    </div>
  )
}
