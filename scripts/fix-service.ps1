# Elevated repair script for discord-mcp Windows NSSM Service
param([switch]$NoPause)
$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Elevating with UAC..." -ForegroundColor Cyan
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Write-Host "=== Fixing discord-mcp Windows NSSM Service ===" -ForegroundColor Green

# 1. Ensure C:\dev\repos junction exists to point to D:\Dev\repos (fleet-wide safety)
if (-not (Test-Path "C:\dev")) {
    New-Item -ItemType Directory -Path "C:\dev" -Force | Out-Null
}
if (-not (Test-Path "C:\dev\repos")) {
    try {
        New-Item -ItemType Junction -Path "C:\dev\repos" -Target "D:\Dev\repos" | Out-Null
        Write-Host "[OK] Created junction C:\dev\repos -> D:\Dev\repos" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Could not create C:\dev\repos junction: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] C:\dev\repos exists" -ForegroundColor Green
}

# 2. Locate NSSM
$nssmCandidates = @(
    "C:\Program Files\Jellyfin\Server\nssm.exe",
    "C:\Users\sandr\AppData\Local\Microsoft\WinGet\Links\nssm.exe"
)
$nssm = $nssmCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $nssm) {
    $cmd = Get-Command nssm -ErrorAction SilentlyContinue
    if ($cmd) { $nssm = $cmd.Source }
}
if (-not $nssm) {
    Write-Host "[ERROR] NSSM executable not found!" -ForegroundColor Red
    if (-not $NoPause) { Read-Host "Press Enter to exit..." }
    exit 1
}
Write-Host "[OK] NSSM found: $nssm" -ForegroundColor Green

# 3. Stop service
Write-Host "Stopping discord-mcp service..." -ForegroundColor Cyan
& $nssm stop discord-mcp 2>$null
Start-Sleep -Seconds 1

# 4. Configure NSSM parameters
$ServiceName = "discord-mcp"
$RepoDir = "D:\Dev\repos\discord-mcp"
$UvPath = "C:\Users\sandr\.local\bin\uv.exe"

& $nssm set $ServiceName Application $UvPath
& $nssm set $ServiceName AppDirectory $RepoDir
& $nssm set $ServiceName AppParameters "run --directory $RepoDir python -m discord_mcp.server --mode dual --port 10756"
& $nssm set $ServiceName AppStdout "$RepoDir\logs\service-stdout.log"
& $nssm set $ServiceName AppStderr "$RepoDir\logs\service-stderr.log"
& $nssm set $ServiceName AppRestartDelay 5000
& $nssm set $ServiceName AppExit Default Restart
& $nssm set $ServiceName Start SERVICE_AUTO_START
Write-Host "[OK] NSSM parameters configured for $ServiceName" -ForegroundColor Green

# 5. Configure AppEnvironmentExtra in registry
$regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName\Parameters"
$envExtra = @(
    "USERPROFILE=C:\Users\sandr",
    "APPDATA=C:\Users\sandr\AppData\Roaming",
    "LOCALAPPDATA=C:\Users\sandr\AppData\Local",
    "HOME=C:\Users\sandr",
    "PORT=10756",
    "FASTMCP_LOG_LEVEL=WARNING"
)
Set-ItemProperty -Path $regPath -Name "AppEnvironmentExtra" -Value $envExtra -Type MultiString
Write-Host "[OK] AppEnvironmentExtra configured in registry" -ForegroundColor Green

# 6. Grant current user service control permissions (service-acl pattern)
try {
    $userSid = ([System.Security.Principal.WindowsIdentity]::GetCurrent()).User.Value
    if ($userSid) {
        $sd = "D:(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCSWLOCRRC;;;AU)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;$userSid)"
        $null = & sc.exe sdset $ServiceName $sd 2>&1
        Write-Host "[OK] Service DACL granted to user $userSid" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARN] DACL update skipped: $_" -ForegroundColor Yellow
}

# 7. Start service
Write-Host "Starting discord-mcp service..." -ForegroundColor Cyan
& $nssm start $ServiceName
Start-Sleep -Seconds 3

# 8. Check health
$status = (& $nssm status $ServiceName 2>&1) -join " "
Write-Host "Service status: $status" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:10756/api/v1/health" -TimeoutSec 5
    Write-Host "[SUCCESS] discord-mcp is healthy on :10756! status=$($r.status) token_set=$($r.token_set)" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Health check did not respond yet: $_" -ForegroundColor Yellow
}

Write-Host "`nAll done! You can close this window." -ForegroundColor Green
if (-not $NoPause) { Read-Host "Press Enter to exit..." }
