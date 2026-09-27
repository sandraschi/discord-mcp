# *********************************************************************************
# * SOTA Fleet Orchestration - Standardized Start System (v1.19.0)                *
# * Generated/Repaired by Antigravity on 2026-09-27                  *
# *********************************************************************************

# Fleet unified launcher - do not edit logic here.
# Change fleet-start.config.ps1 at the repo root instead.
param(
    [switch]$Headless,
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$NoBrowser,
    [switch]$ReuseIfRunning
)

$ErrorActionPreference = 'Stop'
$ReposRoot = if ($env:FLEET_REPOS_ROOT) { $env:FLEET_REPOS_ROOT } else { 'D:\Dev\repos' }
$EnginePath = Join-Path $ReposRoot 'mcp-central-docs\scripts\Invoke-FleetWebappStart.ps1'
if (-not (Test-Path -LiteralPath $EnginePath)) {
    Write-Host "ERROR: Missing fleet start engine: $EnginePath" -ForegroundColor Red
    exit 1
}
. $EnginePath

$configCandidates = @(
    (Join-Path $PSScriptRoot 'fleet-start.config.ps1'),
    (Join-Path (Split-Path -Parent $PSScriptRoot) 'fleet-start.config.ps1')
)
$configPath = $null
foreach ($candidate in $configCandidates) {
    if (Test-Path -LiteralPath $candidate) {
        $configPath = $candidate
        break
    }
}
if (-not $configPath) {
    Write-Host 'ERROR: Missing fleet-start.config.ps1 (repo root or beside start.ps1).' -ForegroundColor Red
    exit 1
}

Start-FleetWebapp @PSBoundParameters -ConfigPath $configPath -LauncherRoot $PSScriptRoot



# --- SOTA PORT SAFETY START ---
# Ports live in fleet-start.config.ps1 (no $Port var in this file).
foreach ($portNum in @(10756, 10757)) {
    Get-NetTCPConnection -LocalPort $portNum -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.OwningProcess -ne $PID) {
            Write-Host "Clearing stale listener on port $portNum (PID $($_.OwningProcess))..." -ForegroundColor Yellow
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Seconds 1
# --- SOTA PORT SAFETY END ---
