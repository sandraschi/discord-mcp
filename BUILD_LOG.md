# discord-mcp BUILD_LOG

Running record for NSIS / packaging builds (fleet gate requirement).

## 2026-10-08 — v0.3.0 release prep (gap-fill A–D + launcher)

**Pre-build audit (TAURI_PRODUCTION_PITFALLS §§A–J, abridged):**
- Pipeline unchanged since last good build (2026-08-25 installer). Delta is
  app code only (Python routes, webapp pages) — no Tauri config, spec, or
  Rust changes. Full A–J re-audit not required; delta risks checked:
- Spec `discord-mcp-backend.spec`: thin (`uvicorn.logging`, `_strptime`
  only, `upx=False`). No `joserfc` hiddenimport — accepted: PyInstaller
  resolves it statically, and the 08-25 build with this spec works.
- Dual Tauri trees exist (`src-tauri/` + `native/`); canonical pipeline is
  `native/` via `just build-native`. Untouched.
- KNOWN SKEW (not fixed this round): Tauri bundle version `0.1.0` vs
  pyproject `0.3.0`. Installer filename says 0.1.0, mcpb says v0.3.0.
  Recommend aligning `native/tauri.conf.json` version before next build
  (requires rebuild — version is baked into the bundle).

**Builds (all green, no failures, no regressions):**
- `scripts\mcpb-pack.ps1` → `dist/discord-mcp-v0.3.0.mcpb` (1,048,809 B,
  309 files). Gate note: prompts are runt (system 743 / user 1020 words,
  examples 1 object vs 3-4-100 spec) — functional bundle, expansion pending.
- `just build-native` → `native\target\release\bundle\nsis\Discord MCP_0.1.0_x64-setup.exe`
  (322,719,515 B), staged to `dist\` by the pipeline itself. Rust release
  compiled 2m09s, makensis clean.
- `sync-tauri-starts.ps1`: 69/69 valid, README refreshed —
  `D:\Dev\Tauri starts\discord-mcp-setup.lnk` now serves the fresh build.

**Verify:** `tsc --noEmit` clean, `ruff` clean, `pytest` 90 passed.
**Not done:** live browser click-through (needs backend restart via
start.bat); CUA NSIS smoke (`just cua-nsis-test`); version alignment.
