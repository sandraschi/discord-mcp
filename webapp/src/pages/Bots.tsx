import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, type IntentsResponse } from "../lib/api";

export default function Bots() {
  const [intents, setIntents] = useState<IntentsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .getIntents()
      .then(setIntents)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const inviteUrl = intents?.invite_url ?? "";
  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-8 py-4 max-w-4xl">
      <div className="flex items-center gap-4">
        <Bot className="text-emerald-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white">Bots</h1>
          <p className="text-slate-400 text-sm">
            What Discord bots are, how they work, and how to register your own
          </p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{err}</p>
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-indigo-400" /> What is a Discord bot?
        </h2>
        <div className="mt-3 space-y-3 text-sm text-slate-300 leading-relaxed">
          <p>
            A bot is an <strong className="text-white">automated Discord account</strong> controlled by a
            program instead of a human. Technically it is an <em>application</em> registered with Discord,
            plus a <strong className="text-white">token</strong> — a secret key that lets your program act as
            the bot.
          </p>
          <p>Bots do everything a user can do, only programmatically:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Post and edit messages in any channel they can see</li>
            <li>Moderate: ban, kick, timeout, assign roles</li>
            <li>Manage servers: create channels, invites, webhooks</li>
            <li>Read the audit log and message history (with the right intents + permissions)</li>
          </ul>
          <p>
            Unlike a human user, a bot <strong className="text-white">cannot log in with a password</strong> —
            it joins servers through an <strong className="text-white">OAuth2 invite URL</strong> that the
            server owner opens and authorizes. The invite URL also decides which permissions the bot gets in
            that server.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-amber-400" /> Registering a new bot (5 minutes)
        </h2>
        <ol className="mt-3 space-y-3 text-sm text-slate-300 leading-relaxed list-decimal list-inside">
          <li>
            Open the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">Discord Developer Portal</a>{" "}
            and click <strong className="text-white">New Application</strong> — give it a name (this becomes the bot's name).
          </li>
          <li>
            Go to the <strong className="text-white">Bot</strong> page and click{" "}
            <strong className="text-white">Reset Token</strong>, then copy the new token. This is your{" "}
            <code className="text-amber-300 bg-black/40 px-1.5 py-0.5 rounded text-xs">DISCORD_TOKEN</code>.
          </li>
          <li>
            On the same page, enable the <strong className="text-white">privileged intents</strong> this server
            needs: <code className="text-indigo-300 bg-black/40 px-1.5 py-0.5 rounded text-xs">GUILD_MEMBERS</code>{" "}
            (member list) and{" "}
            <code className="text-indigo-300 bg-black/40 px-1.5 py-0.5 rounded text-xs">MESSAGE_CONTENT</code>{" "}
            (reading message text for the watcher).
          </li>
          <li>
            Go to <strong className="text-white">OAuth2 → URL Generator</strong>, tick{" "}
            <strong className="text-white">bot</strong>, tick the permissions you want (or{" "}
            <strong className="text-white">Administrator</strong>), and open the generated URL to add the bot
            to your server.
          </li>
          <li>
            Put the token in this app's <code className="text-indigo-300 bg-black/40 px-1.5 py-0.5 rounded text-xs">.env</code>{" "}
            as <code className="text-amber-300 bg-black/40 px-1.5 py-0.5 rounded text-xs">DISCORD_TOKEN=…</code>,
            restart, and the dashboard lights up.
          </li>
        </ol>
        <div className="mt-4 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-200 flex gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <p>
            <strong>Never share or commit a bot token.</strong> Anyone with it can fully control the bot. Keep
            it in <code className="bg-black/40 px-1 py-0.5 rounded text-xs">.env</code> (gitignored) — never in
            source code, READMEs, or screenshots.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0f0f12]/80 p-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-emerald-400" /> Inviting & scaling
        </h2>
        <div className="mt-3 space-y-3 text-sm text-slate-300 leading-relaxed">
          <p>
            An <strong className="text-white">unverified</strong> bot can join at most{" "}
            <strong className="text-white">10 servers</strong>. To go beyond, verify the bot in the Developer
            Portal (Bot → Verification): add a description, an app icon, and a privacy policy. Verified bots
            can join up to 100 servers.
          </p>
          <p>
            The permissions a bot actually has are <strong className="text-white">per-server</strong>: the
            person inviting it can reduce permissions during authorization. This app works best with
            Administrator, but read-only operation (channels, messages, audit log) only needs the matching
            read permissions.
          </p>
        </div>
      </section>

      {intents && (
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-400" /> This dashboard's bot
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Status</p>
              <p className={`mt-1 font-medium ${intents.token_valid ? "text-emerald-300" : "text-red-300"}`}>
                {intents.token_valid ? "Token valid" : "Token invalid / not configured"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Bot account</p>
              <p className="mt-1 font-medium text-slate-200">{intents.username ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Servers joined</p>
              <p className="mt-1 font-medium text-slate-200">{intents.guilds_count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Privileged intents</p>
              <p className="mt-1 font-medium text-slate-200">
                {intents.intents?.guild_members ? "GUILD_MEMBERS ✓" : "GUILD_MEMBERS ✗"}
                {" · "}
                {intents.intents?.message_content ? "MESSAGE_CONTENT ✓" : "MESSAGE_CONTENT ✗"}
              </p>
            </div>
          </div>
          {inviteUrl && (
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <code className="text-xs text-indigo-300 bg-black/40 px-3 py-2 rounded-lg break-all flex-1 min-w-[240px]">
                {inviteUrl}
              </code>
              <button
                type="button"
                onClick={copyInvite}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clipboard className="w-4 h-4" />}
                {copied ? "Copied" : "Copy invite URL"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
