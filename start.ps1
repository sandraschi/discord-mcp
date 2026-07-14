param([switch]$Headless, [switch]$BackendOnly, [switch]$NoBrowser,
    [switch]$ReuseIfRunning)
$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot
$BackendPort = 10756
$FrontendPort = 10757

$portResolve = @{
    Ports      = @($BackendPort, $FrontendPort)
    Label      = "discord-mcp"
    AllowReuse = $ReuseIfRunning
}
if ($ReuseIfRunning) {
    $portResolve.HealthChecks = @{
        $BackendPort = "http://127.0.0.1:$BackendPort/api/v1/health"
        $FrontendPort = "http://127.0.0.1:$FrontendPort/"
    }
}
$portState = Resolve-FleetPortConflict @portResolve
if ($portState.Action -eq 'Blocked') { exit 1 }
if ($portState.Reuse) { return }
# --- SOTA Headless Standard ---
if ($Headless -and ($Host.UI.RawUI.WindowTitle -notmatch 'Hidden')) {
    Start-Process pwsh -ArgumentList '-NoProfile', '-File', $PSCommandPath, '-Headless' -WindowStyle Hidden
    exit
}
$WindowStyle = if ($Headless) { 'Hidden' } else { 'Normal' }
# ------------------------------

$FleetStartPath = Join-Path $ScriptRoot "scripts\FleetStartMode.ps1"
if (-not (Test-Path -LiteralPath $FleetStartPath)) {
    Write-Host "ERROR: Missing vendored launcher helper: $FleetStartPath" -ForegroundColor Red
    exit 1
}
. $FleetStartPath


Write-Host "Syncing Python deps (uv sync) ..." -ForegroundColor Cyan
Push-Location $ScriptRoot
try { uv sync; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } } finally { Pop-Location }

Write-Host "Starting discord-mcp..." -ForegroundColor Cyan

$backendCmd = "Set-Location '$ScriptRoot'; `$env:FASTMCP_LOG_LEVEL='WARNING'; uv run python -m discord_mcp.server --mode dual --port $BackendPort"
$BackendProc = Start-Process powershell -ArgumentList "-NoProfile", "-WindowStyle", $WindowStyle, "-Command", $backendCmd -PassThru

Write-Host "Waiting for backend on port $BackendPort..." -ForegroundColor Gray
$backendReady = $false
for ($i = 0; $i -lt 45; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/api/v1/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $backendReady = $true; break }
    } catch {}
    Start-Sleep 1
}
if ($backendReady) {
    Write-Host "Backend ready on http://127.0.0.1:$BackendPort" -ForegroundColor Green
} else {
    Write-Host "Backend did not return HTTP 200 from /api/v1/health - check logs." -ForegroundColor Yellow
}

if ($BackendOnly) {
    while (-not $BackendProc.HasExited) { Start-Sleep 2 }
    exit
}

$WebRoot = Join-Path $ScriptRoot "webapp"
if (-not (Test-Path (Join-Path $WebRoot "node_modules"))) {
    Set-Location $WebRoot
    npm install
}

if (-not $NoBrowser) {
    $frontendUrl = "http://127.0.0.1:$FrontendPort/"
    $pollAndOpen = "for (`$i = 0; `$i -lt 60; `$i++) { try { `$null = Invoke-WebRequest -Uri '$frontendUrl' -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop; Start-Process '$frontendUrl'; exit } catch { Start-Sleep -Seconds 1 } }"
    Start-Process powershell -ArgumentList "-NoProfile", "-WindowStyle", "Hidden", "-Command", $pollAndOpen
}

Write-Host "Starting Vite frontend on port $FrontendPort..." -ForegroundColor Green
for ($i = 0; $i -lt 10; $i++) {
    $listeners = Get-NetTCPConnection -LocalPort $FrontendPort -ErrorAction SilentlyContinue
    if (-not $listeners) { break }
    Start-Sleep -Milliseconds 500
}
Set-Location $WebRoot
npm run dev -- --port $FrontendPort --host --strictPort


