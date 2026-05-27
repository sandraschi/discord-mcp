param([switch]$Headless, [switch]$BackendOnly, [switch]$NoBrowser)
$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot
$BackendPort = 10756
$FrontendPort = 10757

# --- SOTA Headless Standard ---
if ($Headless -and ($Host.UI.RawUI.WindowTitle -notmatch 'Hidden')) {
    Start-Process pwsh -ArgumentList '-NoProfile', '-File', $PSCommandPath, '-Headless' -WindowStyle Hidden
    exit
}
$WindowStyle = if ($Headless) { 'Hidden' } else { 'Normal' }
# ------------------------------

# Port zombie clearing
Get-NetTCPConnection -LocalPort $BackendPort -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort $FrontendPort -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host "Starting discord-mcp..." -ForegroundColor Cyan

# Start backend via Start-Job
$env:FASTMCP_LOG_LEVEL = "WARNING"
$BackendJob = Start-Job -Name "discord-backend" -ScriptBlock {
    param($Root, $Port)
    Set-Location $Root
    & uv run python -m discord_mcp.server --mode dual --port $Port
} -ArgumentList $ScriptRoot, $BackendPort

# Readiness poll
Write-Host "Waiting for backend on port $BackendPort..." -ForegroundColor Gray
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/api/v1/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep 1
}
Write-Host "Backend ready on http://127.0.0.1:$BackendPort" -ForegroundColor Green

if (-not $BackendOnly) {
    # Start frontend via Start-Process
    $WebRoot = Join-Path $ScriptRoot "webapp"
    $FrontendProc = Start-Process -NoNewWindow -FilePath "npx" -ArgumentList "vite --port $FrontendPort --host" -WorkingDirectory $WebRoot -PassThru

    # Auto-open browser
    if (-not $NoBrowser) {
        Start-Sleep 2
        Start-Process "http://127.0.0.1:$FrontendPort"
    }
}

# Keep-alive
while ($true) {
    if ($BackendJob.State -eq "Completed" -or $BackendJob.State -eq "Failed") {
        Write-Host "Backend stopped." -ForegroundColor Red
        Receive-Job $BackendJob
        break
    }
    Start-Sleep 2
}
