# Onboarding — discord-mcp

Get the Discord bridge working in ~10 minutes. No account needed except a free
Discord bot token.

## 1. What this is for

`discord-mcp` bridges your Discord servers to MCP clients (Cursor, Claude Desktop)
and a web dashboard: list servers, read/post messages, moderate, search history
with RAG, run agentic workflows. Ports: backend **10756**, dashboard **10757**.

## 2. Money / accounts

- **Cost:** free. Discord bot token is free; local RAG defaults to Ollama
  (free, on-machine). No cloud key required.
- **Account:** one Discord application at
  <https://discord.com/developers/applications> (Bot → Reset Token).

## 3. Setup (first time)

```powershell
git clone https://github.com/sandraschi/discord-mcp
cd discord-mcp
Copy-Item .env.example .env
# edit .env: DISCORD_TOKEN=<your bot token>
.\start.ps1
```

Invite URL ints bot into your server (Admin `permissions=8` requested; owners may
reduce it — the bot can only do what each server granted). Unverified bots join
**10 servers max**; verify in the Developer Portal to raise the cap.

## 4. Pitfalls

- **Privileged intents:** `GUILD_MEMBERS` and `MESSAGE_CONTENT` must be enabled in
  Developer Portal → Bot, or member lists / message reads come back empty. The
  dashboard shows intent status.
- **Rate limits:** server-side anti-spam (10 msgs/min global, 3/channel/min) fires
  before Discord's own 429s. Hitting one returns a structured 429 naming the limit
  and its env override (`DISCORD_RATE_LIMIT_*`).
- **NSSM service:** `start.ps1` restarts the Windows service (one UAC prompt).
  Never taskkill the service child — NSSM owns that process.

## 5. Sanity check

1. Backend: `http://127.0.0.1:10756/api/v1/health` returns `{"status":"ok"}`.
2. Dashboard: `http://127.0.0.1:10757` shows your servers.
3. In an MCP client: `discord(operation="list_guilds")` lists them.

Troubleshooting: `docs/TROUBLESHOOTING.md`. Config reference:
`docs/CONFIGURATION.md`.
