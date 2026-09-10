# Elevated Fleet RAM Optimizer
# Eliminates idle uv.exe and powershell.exe wrapper processes by repointing
# NSSM services directly to their virtualenv executables.

$ErrorActionPreference = "Continue"
$LogFile = "D:\Dev\repos\discord-mcp\logs\optimize-fleet-ram.log"
New-Item -ItemType Directory -Force -Path "D:\Dev\repos\discord-mcp\logs" | Out-Null
"=== Optimization run at $(Get-Date) ===" | Out-File $LogFile -Append -Encoding utf8

function Out-Both([string]$msg, [string]$color = "White") {
    Write-Host $msg -ForegroundColor $color
    $msg | Out-File $LogFile -Append -Encoding utf8
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Out-Both "Requesting Administrator rights to update service configurations..." "Yellow"
    Start-Process powershell.exe -ArgumentList @('-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath) -Verb RunAs
    exit
}

function Get-FleetServiceRAM {
    $svcs = @(
        'advanced-memory-mcp','advanced-memory-mcp-daemon','aiwatcher-mcp','arxiv-mcp','devices-mcp',
        'discord-mcp','email-mcp','fastsearch-mcp','fleet-agent-mcp','fleet-hub','mcp-federation-hub',
        'mcp-pywinauto-mcp','ollama-serve','RustDeskHbbr','RustDeskHbbs','tvtropes-mcp'
    )
    $allProcs = Get-CimInstance Win32_Process
    $data = @{}
    foreach ($s in $svcs) {
        $svcObj = Get-CimInstance Win32_Service -Filter "Name='$s'" -ErrorAction SilentlyContinue
        if (-not $svcObj -or $svcObj.ProcessId -eq 0) {
            $data[$s] = 0
            continue
        }
        $pids = @($svcObj.ProcessId)
        $q = @($svcObj.ProcessId)
        while ($q.Count -gt 0) {
            $curr = $q[0]
            $q = $q[1..$q.Length]
            $ch = $allProcs | Where-Object { $_.ParentProcessId -eq $curr }
            foreach ($c in $ch) {
                $pids += $c.ProcessId
                $q += $c.ProcessId
            }
        }
        $pObjs = Get-Process -Id $pids -ErrorAction SilentlyContinue
        $ws = ($pObjs | Measure-Object -Property WorkingSet64 -Sum).Sum / 1MB
        $data[$s] = [math]::Round($ws, 1)
    }
    return $data
}

Out-Both "=== Measuring Baseline RAM Usage ===" "Cyan"
$beforeRAM = Get-FleetServiceRAM
$beforeTotal = ($beforeRAM.Values | Measure-Object -Sum).Sum
Out-Both "Baseline Fleet RAM: $([math]::Round($beforeTotal, 1)) MB ($([math]::Round($beforeTotal / 1024, 2)) GB)`n" "Yellow"

# Configuration mapping: Service -> Direct Executable + Args + Dir + ExtraEnv
$configs = @{
    'advanced-memory-mcp' = @{
        App = "D:\Dev\repos\advanced-memory-mcp\.venv\Scripts\uvicorn.exe"
        Dir = "D:\Dev\repos\advanced-memory-mcp"
        Args = "advanced_memory.server:app --host 127.0.0.1 --port 10705"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\advanced-memory-mcp\.venv")
    }
    'advanced-memory-mcp-daemon' = @{
        App = "D:\Dev\repos\advanced-memory-mcp\.venv\Scripts\python.exe"
        Dir = "D:\Dev\repos\advanced-memory-mcp"
        Args = "-m advanced_memory.cli.main mcp --transport streamable-http --host 127.0.0.1 --port 10732"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\advanced-memory-mcp\.venv")
    }
    'aiwatcher-mcp' = @{
        App = "D:\Dev\repos\aiwatcher-mcp\.venv\Scripts\python.exe"
        Dir = "D:\Dev\repos\aiwatcher-mcp"
        Args = "-m aiwatcher_mcp.api"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\aiwatcher-mcp\.venv")
    }
    'arxiv-mcp' = @{
        App = "D:\Dev\repos\arxiv-mcp\.venv\Scripts\python.exe"
        Dir = "D:\Dev\repos\arxiv-mcp"
        Args = "-m arxiv_mcp.__main__ --serve"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\arxiv-mcp\.venv", "ARXIV_MCP_PORT=10770", "ARXIV_MCP_HOST=127.0.0.1")
    }
    'devices-mcp' = @{
        App = "D:\Dev\repos\devices-mcp\.venv\Scripts\python.exe"
        Dir = "D:\Dev\repos\devices-mcp\web-sota"
        Args = "-m backend.server --host 127.0.0.1 --port 10717"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\devices-mcp\.venv")
    }
    'discord-mcp' = @{
        App = "D:\Dev\repos\discord-mcp\.venv\Scripts\python.exe"
        Dir = "D:\Dev\repos\discord-mcp"
        Args = "-m discord_mcp.server --mode dual --port 10756"
        Env = @(
            "VIRTUAL_ENV=D:\Dev\repos\discord-mcp\.venv",
            "USERPROFILE=C:\Users\sandr",
            "APPDATA=C:\Users\sandr\AppData\Roaming",
            "LOCALAPPDATA=C:\Users\sandr\AppData\Local",
            "HOME=C:\Users\sandr",
            "PORT=10756",
            "FASTMCP_LOG_LEVEL=WARNING"
        )
    }
    'email-mcp' = @{
        App = "D:\Dev\repos\email-mcp\.venv\Scripts\python.exe"
        Dir = "D:\Dev\repos\email-mcp"
        Args = "-m email_mcp.server --http --port 10813"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\email-mcp\.venv", "PORT=10813", "MCP_PORT=10813")
    }
    'fastsearch-mcp' = @{
        App = "D:\Dev\repos\fastsearch-mcp\.venv\Scripts\uvicorn.exe"
        Dir = "D:\Dev\repos\fastsearch-mcp"
        Args = "fastsearch_mcp.server:app --host 127.0.0.1 --port 10845"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\fastsearch-mcp\.venv")
    }
    'fleet-agent-mcp' = @{
        App = "D:\Dev\repos\fleet-agent-mcp\.venv\Scripts\python.exe"
        Dir = "D:\Dev\repos\fleet-agent-mcp"
        Args = "run_server.py"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\fleet-agent-mcp\.venv")
    }
    'fleet-hub' = @{
        App = "D:\Dev\repos\fleet-agent-mcp\.venv\Scripts\python.exe"
        Dir = "D:\Dev\repos\fleet-agent-mcp"
        Args = "-m fleet_agent.intel_hub"
        Env = @(
            "VIRTUAL_ENV=D:\Dev\repos\fleet-agent-mcp\.venv",
            "INTEL_REPORTS_HUB_USER=fleet",
            "INTEL_REPORTS_HUB_PASS=intel"
        )
    }
    'mcp-federation-hub' = @{
        App = "D:\Dev\repos\mcp-federation-hub\bridge\.venv\Scripts\uvicorn.exe"
        Dir = "D:\Dev\repos\mcp-federation-hub\bridge"
        Args = "app.main:app --host 127.0.0.1 --port 10857 --log-level info"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\mcp-federation-hub\bridge\.venv")
    }
    'mcp-pywinauto-mcp' = @{
        App = "D:\Dev\repos\pywinauto-mcp\.venv\Scripts\windows-computer-use-mcp.exe"
        Dir = "D:\Dev\repos\pywinauto-mcp"
        Args = "--http --port 10789"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\pywinauto-mcp\.venv")
    }
    'tvtropes-mcp' = @{
        App = "D:\Dev\repos\tvtropes-mcp\.venv\Scripts\python.exe"
        Dir = "D:\Dev\repos\tvtropes-mcp"
        Args = "run_server.py"
        Env = @("VIRTUAL_ENV=D:\Dev\repos\tvtropes-mcp\.venv", "PORT=10964", "MCP_PORT=10964")
    }
}

# 1. Backup current parameters
$backup = @{}
foreach ($svcName in $configs.Keys) {
    $paramPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$svcName\Parameters"
    if (Test-Path $paramPath) {
        $props = Get-ItemProperty $paramPath
        $backup[$svcName] = @{
            Application = $props.Application
            AppDirectory = $props.AppDirectory
            AppParameters = $props.AppParameters
            AppEnvironmentExtra = $props.AppEnvironmentExtra
        }
    }
}
$backup | ConvertTo-Json -Depth 4 | Set-Content "D:\Dev\repos\discord-mcp\logs\nssm-backup-before-opt.json" -Encoding utf8
Out-Both "[OK] Backed up pre-optimization settings to logs\nssm-backup-before-opt.json" "Green"

# 2. Apply direct configs
Out-Both "`n=== Updating NSSM Configurations to Direct Executables ===" "Cyan"
foreach ($svcName in ($configs.Keys | Sort-Object)) {
    $c = $configs[$svcName]
    $paramPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$svcName\Parameters"
    
    if (-not (Test-Path $c.App)) {
        Out-Both "  [SKIP] Executable not found for ${svcName}: $($c.App)" "Red"
        continue
    }

    Set-ItemProperty -Path $paramPath -Name "Application" -Value $c.App
    Set-ItemProperty -Path $paramPath -Name "AppDirectory" -Value $c.Dir
    Set-ItemProperty -Path $paramPath -Name "AppParameters" -Value $c.Args
    if ($c.Env) {
        Set-ItemProperty -Path $paramPath -Name "AppEnvironmentExtra" -Value $c.Env -Type MultiString
    }
    Out-Both "  [UPDATED] $svcName -> $(Split-Path $c.App -Leaf)" "Green"
}

# 3. Restart services to apply
Out-Both "`n=== Restarting Services with Optimized Configurations ===" "Cyan"
foreach ($svcName in ($configs.Keys | Sort-Object)) {
    Out-Both "  Restarting $svcName..." "Yellow"
    & sc.exe stop $svcName 2>&1 | Out-Null
    for ($i = 0; $i -lt 20; $i++) {
        $st = (Get-Service $svcName -ErrorAction SilentlyContinue).Status
        if ($st -eq "Stopped") { break }
        Start-Sleep -Milliseconds 500
    }
    & sc.exe start $svcName 2>&1 | Out-Null
    Start-Sleep -Milliseconds 300
}

Out-Both "`nWaiting 10 seconds for services to settle..." "Yellow"
Start-Sleep -Seconds 10

# 4. Measure New RAM
Out-Both "`n=== Measuring Optimized RAM Usage ===" "Cyan"
$afterRAM = Get-FleetServiceRAM
$afterTotal = ($afterRAM.Values | Measure-Object -Sum).Sum

Out-Both "`n----------------------------------------------------------------------" "White"
Out-Both ("{0,-28} | {1,12} | {2,12} | {3,12}" -f "Service Name", "Before (MB)", "After (MB)", "Saved (MB)") "White"
Out-Both "----------------------------------------------------------------------" "White"

foreach ($s in ($configs.Keys | Sort-Object)) {
    $b = $beforeRAM[$s]
    $a = $afterRAM[$s]
    $saved = [math]::Round($b - $a, 1)
    $color = if ($saved -gt 0) { "Green" } elseif ($saved -eq 0) { "White" } else { "Yellow" }
    Out-Both ("{0,-28} | {1,10} MB | {2,10} MB | {3,10} MB" -f $s, $b, $a, $saved) $color
}

$totalSaved = [math]::Round($beforeTotal - $afterTotal, 1)
Out-Both "----------------------------------------------------------------------" "White"
Out-Both ("{0,-28} | {1,10} MB | {2,10} MB | {3,10} MB" -f "TOTAL FLEET SERVICES", [math]::Round($beforeTotal, 1), [math]::Round($afterTotal, 1), $totalSaved) "Green"
Out-Both "======================================================================" "Green"
Out-Both "TOTAL RAM SAVED: $totalSaved MB ($([math]::Round($totalSaved / 1024, 2)) GB)" "Green"
Out-Both "======================================================================`n" "Green"
