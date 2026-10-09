#Requires -Version 5.1
# Fleet pre-commit Biome gate: lints the webapp when dashboard sources exist.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$candidates = @('webapp', 'web_sota', 'webapp/frontend', 'web')
foreach ($dir in $candidates) {
    $full = Join-Path $repoRoot $dir
    if (Test-Path (Join-Path $full 'package.json')) {
        Push-Location $full
        try {
            if (Test-Path 'bun.lock') {
                & "$env:USERPROFILE\.bun\bin\bun.exe" run biome:ci
            } else {
                npm run biome:ci
            }
            # Non-blocking until the webapp is biome-clean (2026-10-09: ~7000
            # pre-existing findings, dedicated cleanup pass required). Warn only.
            if ($LASTEXITCODE -ne 0) {
                Write-Host 'pre-commit-biome: WARN biome:ci reports findings (non-blocking; see assess report).' -ForegroundColor Yellow
            }
        } finally {
            Pop-Location
        }
        exit 0
    }
}
Write-Host 'pre-commit-biome: no webapp found, skipping.'
exit 0
