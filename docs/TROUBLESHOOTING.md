# Troubleshooting

## Server doesn't appear in Cursor / Claude Desktop

**Cause:** Invalid MCP JSON or wrong `cwd` / missing token  
**Fix:** Validate JSON (no trailing commas). Set `DISCORD_TOKEN` in `env` or `.env`. Restart the host. See [CURSOR-MCP.md](./CURSOR-MCP.md).

## `DISCORD_TOKEN` not set / tool returns token error

**Cause:** No token in env, `.env`, or MCP config  
**Fix:** Copy `.env.example` → `.env`, set token, restart server. OS/Cursor env wins over `.env` — check for empty overrides.

## `command not found: uv`

**Cause:** uv not installed or not on PATH  
**Fix:** `winget install astral-sh.uv` — restart terminal.

## `just` not found

**Cause:** just not installed  
**Fix:** `winget install Casey.Just` — or use manual path in [INSTALL.md](../INSTALL.md#option-c--manual-from-source).

## Port 10756 or 10757 already in use

**Cause:** Another fleet server or stale process  
**Fix:** Stop the other service or change `PORT` in `.env`. Fleet: clear ports 10700–11000 if you use central kill scripts.

## Rate limited by discord-mcp

**Cause:** In-repo anti-spam limits (messages, channels, invites)  
**Fix:** Wait for the window to reset. Check limits in `GET /api/v1/health` → `rate_limit`. Tune via `DISCORD_RATE_LIMIT_*` in [CONFIGURATION.md](./CONFIGURATION.md).

## Discord HTTP 429 (API rate limit)

**Cause:** Discord per-route limits; too many parallel requests  
**Fix:** Server auto-retries up to 5 times using `retry_after`. If still failing, slow down (smaller batches, fewer parallel fetches). If `"global": true` in the response, wait ~1 minute. Details: [TECHNICAL.md](./TECHNICAL.md#discord-api-http-429).

## `list_members` empty or 403

**Cause:** **GUILD_MEMBERS** privileged intent disabled  
**Fix:** Discord Developer Portal → Bot → enable **Server Members Intent** → re-invite bot if needed.

## `create_guild` returns 403

**Cause:** Bots cannot create guilds via this API — requires user OAuth2  
**Fix:** Use a user token flow or create the server manually in Discord.

## Agentic workflow fails / no sampling

**Cause:** Host has no sampling; Ollama not running  
**Fix:** Start Ollama or set `DISCORD_SAMPLING_*`. Or set `DISCORD_SAMPLING_USE_CLIENT_LLM=1` when the host supports sampling. Check `/api/v1/health` → `sampling`.

## Dashboard blank / API errors

**Cause:** Backend not running or wrong proxy  
**Fix:** Ensure backend on **10756** before opening **10757**. Use `.\start.ps1` for both. Check browser devtools for failed `/api` calls.

## Dependencies out of sync

**Fix:** `uv sync --all-extras` and `Set-Location webapp; npm install`

## Still stuck

[Open a GitHub issue](https://github.com/sandraschi/discord-mcp/issues) with `/api/v1/health` output (redact token).
