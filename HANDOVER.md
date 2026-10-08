# discord-mcp — HANDOVER (2026-10-08)

## What was being worked on
Webapp hang triage (Members / Invites / Server tree spinners) + "no silent
failures" pass + new Recents page + Dashboard KPIs/quick actions. Discord
channel backfill drip for the Sept bulk-created `15504…` stub channels
(5 of ~100 done: calibre, email, immich, iptv, komga). Launcher rewritten
as full orchestrator (start.ps1).

## Last concrete action
- Patched 13 files + new Recents.tsx + HANDOVER.md + AGENTS.md rule.
- Verified: `tsc --noEmit` clean (x4), `ruff` clean on both backend files,
  `pytest` 90 passed / 8 skipped / 1 xfailed, start.ps1 syntax OK.
- Committed + pushed everything (this handover included).

## Files changed (mine, this session)
Backend: `src/discord_mcp/portmanteau.py` (Discord timeout 120→20s,
`last_message_id` in channel dicts, new `recent` op), `src/discord_mcp/server.py`
(`GET /api/v1/guilds/{id}/recent`).
Webapp: `ServerTree` (lazy threads on expand), `Members`/`Invites`/`ServerTree`
+ global `AppLayout` banner (server-list errors visible), `Invites` +
`ScheduledMessages` channel-list/cancel errors, `Chat` storage/skills/poll/
approve errors, `Recents` page + route + nav, `Dashboard` 4 KPIs + 6 actions,
`api.ts` `getRecent`, `useGuildPicker` exposes loading/error.
Launcher: `start.ps1` (UAC self-elevate, sc stop/start with fresh-PID check,
frontend recycle, health verify). `AGENTS.md` session-close rule.

## Next step
1. Double-click start.bat (one UAC click) → backend picks up new code,
   frontend rebuilds. Verify Members / Server tree / Recents in browser.
2. Continue channel backfill drip (~95 stubs left, 1 post / 30s max).
3. Follow-ups (deliberately NOT done): `just lint` still fails on
   pre-existing `scripts/cua-*.py` ruff nits + `biome.json` schema drift;
   `biome ci` blocked by config, not by changed files.

## Blockers
None. Live E2E of the `recent` op needs the restarted backend (running
service still has pre-patch code — proven by old tool schema).

## Deliberately NOT done
- No deletes/edits of existing Discord starter posts (runt #1 kept,
  detailed post as #2).
- No mass channel fill (rate-limit discipline).
- No commit of `.bak` files (gitignored) — clean with
  `Get-ChildItem -Recurse -Filter "*.bak" | Remove-Item` once accepted.
- No changes to `mcp-central-docs` engine (out of scope, noted).

## 2026-10-08 follow-up: two launchers, engine didn't know NSSM
Symptom: clicking `mcp-central-docs/starts/discord-start.bat` failed with
"port still held by PID, set Backend.Kind='nssm' or Backend.NssmService".
Root cause: that wrapper drove `webapp/start.ps1` directly and the fleet
config declared `Backend.Kind='uvicorn'` while :10756 is owned by the
`discord-mcp` NSSM service — engine correctly refused to orphan-kill and
had no service name to restart. The repo-root `start.ps1` orchestrator was
never in the loop.
Fix: config now declares `NssmService='discord-mcp'` + `Kind='nssm'`
(canonical repair-script schema); wrapper funnels to repo `start.bat`
(single orchestrator: UAC → sc stop/start with fresh-PID verify → frontend
→ health gates). Next step unchanged: click it, approve UAC once.

## 2026-10-08 (later): backend tools surfaced in webapp (A→D)
P1 moderation: message edit/delete, member timeout, invite revoke.
P2: channel edit dialog, pins panel + per-message Pin, webhook test-fire,
EmbedBuilder silent channel-load fixed. P3: NEW permissions routes +
Roles overwrites matrix, DM mode on Send, guild rename on Guilds.
P4: live prompt descriptions on Tools. WONTDO: emoji/sticker browsers.
Verified each batch (tsc, ruff, pytest 90). 5 commits pushed, tree clean.
Live browser click-through still needs the restarted backend.
