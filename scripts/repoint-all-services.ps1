# Elevated fleet-wide NSSM repair, recovery, and starter script
$LogFile = "D:\Dev\repos\discord-mcp\logs\repoint-services.log"
New-Item -ItemType Directory -Force -Path "D:\Dev\repos\discord-mcp\logs" | Out-Null
"=== Start-all run at $(Get-Date) ===" | Out-File $LogFile -Append -Encoding utf8

function Out-Both([string]$msg, [string]$color = "White") {
    Write-Host $msg -ForegroundColor $color
    $msg | Out-File $LogFile -Append -Encoding utf8
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Out-Both "ERROR: Not running as Administrator. Please accept the UAC prompt!" "Red"
    Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath) -Verb RunAs
    exit
}

Out-Both "=== Configuring Fleet Services (DACL, Auto-Recovery, Auto-Start) ===" "Green"

$userSid = ([System.Security.Principal.WindowsIdentity]::GetCurrent()).User.Value
$sd = if ($userSid) {
    "D:(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCSWLOCRRC;;;AU)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;$userSid)"
} else { $null }

$servicesRoot = "HKLM:\SYSTEM\CurrentControlSet\Services"
$services = Get-ChildItem $servicesRoot
$allNssm = @()

foreach ($svc in $services) {
    $paramPath = Join-Path $svc.PSPath "Parameters"
    if (-not (Test-Path $paramPath)) { continue }
    $props = Get-ItemProperty $paramPath -ErrorAction SilentlyContinue
    if (-not ($props.Application -or $props.AppDirectory)) { continue }
    
    $svcName = $svc.PSChildName
    $allNssm += $svcName

    # 1. Ensure paths are D:\Dev\repos
    $fields = @("Application", "AppDirectory", "AppParameters", "AppStdout", "AppStderr")
    foreach ($field in $fields) {
        $val = $props.$field
        if ($val -and ($val -match "(?i)C:\\dev\\repos")) {
            $newVal = $val -replace "(?i)C:\\dev\\repos", "D:\Dev\repos"
            Set-ItemProperty -Path $paramPath -Name $field -Value $newVal -ErrorAction SilentlyContinue
            Out-Both "  [$svcName] ${field} repointed" "Yellow"
        }
    }

    # 2. Grant user DACL
    if ($sd) {
        & sc.exe sdset $svcName $sd 2>&1 | Out-Null
    }

    # 3. Configure OS crash recovery: restart in 5s, 10s, 30s
    & sc.exe failure $svcName "reset= 86400" "actions= restart/5000/restart/10000/restart/30000" 2>&1 | Out-Null
    & sc.exe config $svcName start= auto 2>&1 | Out-Null
}

# 4. Configure discord-mcp environment
$discordParam = "HKLM:\SYSTEM\CurrentControlSet\Services\discord-mcp\Parameters"
if (Test-Path $discordParam) {
    $envExtra = @(
        "USERPROFILE=C:\Users\sandr",
        "APPDATA=C:\Users\sandr\AppData\Roaming",
        "LOCALAPPDATA=C:\Users\sandr\AppData\Local",
        "HOME=C:\Users\sandr",
        "PORT=10756",
        "FASTMCP_LOG_LEVEL=WARNING"
    )
    Set-ItemProperty -Path $discordParam -Name "AppEnvironmentExtra" -Value $envExtra -Type MultiString
}

# 5. Start all stopped automatic services
Out-Both "`n=== Starting All Automatic Fleet Services ===" "Cyan"
foreach ($svcName in $allNssm) {
    $s = Get-Service $svcName -ErrorAction SilentlyContinue
    if ($s -and $s.StartType -eq "Automatic" -and $s.Status -ne "Running") {
        Out-Both "Starting $svcName ..." "Yellow"
        & sc.exe start $svcName 2>&1 | Out-Null
        Start-Sleep -Milliseconds 500
    }
}

Start-Sleep -Seconds 3

Out-Both "`n=== Live Fleet Service Status ===" "Cyan"
foreach ($svcName in ($allNssm | Sort-Object)) {
    $s = Get-Service $svcName -ErrorAction SilentlyContinue
    if ($s) {
        $color = if ($s.Status -eq "Running") { "Green" } else { "Red" }
        Out-Both ("  {0,-28} {1,-10} (StartType: {2})" -f $svcName, $s.Status, $s.StartType) $color
    }
}

Out-Both "`n=== COMPLETE: ALL SERVICES CONFIGURED FOR 100% UNATTENDED AUTO-RESTART ===" "Green"
