# *********************************************************************************
# * discord-mcp launcher: full-stack restart orchestrator                         *
# * Double-click start.bat, approve ONE UAC prompt, done. Everything else below   *
# * is automatic: backend (NSSM service when present) -> frontend (vite) ->       *
# * health verify. Never taskkill the service child; NSSM owns that process.     *
# *********************************************************************************
param(
    [switch]$Headless,
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$NoBrowser,
    [switch]$ReuseIfRunning
)

$ErrorActionPreference = 'Stop'
$ServiceName  = 'discord-mcp'
$BackendPort  = 10756
$FrontendPort = 10757
$BackendHealth = "http://127.0.0.1:$BackendPort/api/v1/health"

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-PortPid {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($conn) { return $conn.OwningProcess }
    return $null
}

function Wait-PortListen {
    param([int]$Port, [int]$Seconds = 60, [int]$NotPid = 0)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        $pid = Get-PortPid -Port $Port
        if ($pid -and $pid -ne $NotPid) { return $pid }
        Start-Sleep -Seconds 2
    }
    return $null
}

function Wait-HttpOk {
    param([string]$Url, [int]$Seconds = 60)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { return $true }
        } catch { Start-Sleep -Seconds 2 }
    }
    return $false
}

function Fail([string]$msg) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

# 0. One UAC prompt when service control is needed. Relaunch self elevated.
if ($service -and -not $FrontendOnly -and -not (Test-IsAdmin)) {
    Write-Host 'Service restart needs admin - relaunching elevated (one UAC click)...' -ForegroundColor Yellow
    $flags = @()
    foreach ($name in @('Headless', 'BackendOnly', 'FrontendOnly', 'NoBrowser', 'ReuseIfRunning')) {
        if ((Get-Variable -Name $name -ValueOnly)) { $flags += "-$name" }
    }
    $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" $($flags -join ' ')"
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argList
    exit 0
}

# Fast path: everything already healthy.
if ($ReuseIfRunning) {
    $backOk = $true
    if (-not $FrontendOnly) { $backOk = Wait-HttpOk -Url $BackendHealth -Seconds 5 }
    $frontPid = Get-PortPid -Port $FrontendPort
    if ($backOk -and ($BackendOnly -or $frontPid)) {
        Write-Host 'Already running and healthy - reusing.' -ForegroundColor Green
        exit 0
    }
    Write-Host 'Reuse requested but stack unhealthy - full restart...' -ForegroundColor Yellow
}

# 1. Backend via the service manager. NEVER Stop-Process the service child.
if (-not $FrontendOnly) {
    if ($service) {
        $oldPid = Get-PortPid -Port $BackendPort
        Write-Host "Restarting service $ServiceName (old backend PID: $oldPid)..." -ForegroundColor Cyan
        try {
            $svc = Get-Service -Name $ServiceName
            $svc.Stop()
            $svc.WaitForStatus('Stopped', '00:00:30')
            $svc.Start()
            $svc.WaitForStatus('Running', '00:00:30')
        } catch { Fail "service restart failed: $($_.Exception.Message)" }
        $newPid = Wait-PortListen -Port $BackendPort -Seconds 60 -NotPid ([int]($oldPid -as [string] -replace '\D'))
        if (-not $newPid) { Fail "backend did not re-bind :$BackendPort with a fresh PID" }
        if ($oldPid -and $newPid -eq $oldPid) { Fail "backend PID unchanged ($newPid) - restart did not take" }
        Write-Host "Backend fresh on :$BackendPort (PID $oldPid -> $newPid)." -ForegroundColor Green
        if (-not (Wait-HttpOk -Url $BackendHealth -Seconds 60)) { Fail "backend unhealthy at $BackendHealth" }
        Write-Host 'Backend health OK.' -ForegroundColor Green
    }
}

# 2. Frontend (vite is ours, not the service - safe to recycle) via fleet engine.
$ReposRoot = if ($env:FLEET_REPOS_ROOT) { $env:FLEET_REPOS_ROOT } else { 'D:\Dev\repos' }
$EnginePath = Join-Path $ReposRoot 'mcp-central-docs\scripts\Invoke-FleetWebappStart.ps1'
if (-not (Test-Path -LiteralPath $EnginePath)) { Fail "Missing fleet start engine: $EnginePath" }
. $EnginePath

$configPath = Join-Path $PSScriptRoot 'fleet-start.config.ps1'
if (-not (Test-Path -LiteralPath $configPath)) { Fail 'Missing fleet-start.config.ps1 at repo root.' }

if (-not $BackendOnly) {
    $existing = Get-PortPid -Port $FrontendPort
    if ($existing) {
        $proc = Get-Process -Id $existing -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq 'node') {
            Write-Host "Recycling stale frontend (PID $existing)..." -ForegroundColor Yellow
            Stop-Process -Id $existing -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
    }
    if ($service) {
        Start-FleetWebapp -FrontendOnly -ConfigPath $configPath -LauncherRoot $PSScriptRoot
    } else {
        Start-FleetWebapp @PSBoundParameters -ConfigPath $configPath -LauncherRoot $PSScriptRoot
    }
    $frontPid = Wait-PortListen -Port $FrontendPort -Seconds 90
    if (-not $frontPid) { Fail "frontend did not bind :$FrontendPort" }
    Write-Host "Frontend live on :$FrontendPort (PID $frontPid)." -ForegroundColor Green
}

# 3. Legacy port safety: only when NO service owns the backend (other machines).
#    With a service present the block above already guarantees fresh PIDs;
#    blind Stop-Process here would murder the service child NSSM just spawned.
if (-not $service) {
    foreach ($portNum in @($BackendPort, $FrontendPort)) {
        Get-NetTCPConnection -LocalPort $portNum -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.OwningProcess -ne $PID) {
                Write-Host "Clearing stale listener on port $portNum (PID $($_.OwningProcess))..." -ForegroundColor Yellow
                Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Start-Sleep -Seconds 1
}

Write-Host 'discord-mcp stack up.' -ForegroundColor Green
