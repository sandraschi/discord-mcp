import { useState } from 'react'
import { Send, AlertCircle, CheckCircle } from 'lucide-react'
import { api } from '../lib/api'

export default function SendMessage() {
  const [channelId, setChannelId] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!channelId.trim() || !content.trim()) return
    setLoading(true)
    setErr(null)
    setSuccess(null)
    api
      .sendMessage(channelId.trim(), content.trim())
      .then(() => {
        setSuccess(`Message sent to channel ${channelId}.`)
        setContent('')
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }

  return (
    <div className="space-y-6 py-4 max-w-2xl">
      <div className="flex items-center gap-4">
        <Send className="text-indigo-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Send message</h1>
          <p className="text-slate-400 text-sm">Post to a channel (rate limited)</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{err}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">Channel ID</label>
          <input
            type="text"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="e.g. 123456789012345678"
            className="w-full rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-3 text-slate-200 font-mono"
            required
          />
        </div>
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Message text…"
            rows={4}
            maxLength={2000}
            className="w-full rounded-xl bg-[#0f0f12] border border-white/10 px-4 py-3 text-slate-200 resize-y"
            required
          />
          <p className="text-slate-500 text-xs mt-1">{content.length} / 2000</p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
        >
          <Send className="w-4 h-4" /> {loading ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
