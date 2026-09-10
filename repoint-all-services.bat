@echo off
setlocal
cd /d "%~dp0"
echo =======================================================
echo Requesting Administrator rights to repoint NSSM services
echo =======================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$script = Join-Path $pwd 'scripts\repoint-all-services.ps1'; Start-Process powershell.exe -ArgumentList @('-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', $script) -Verb RunAs"
if errorlevel 1 (
    echo Elevation was cancelled or failed.
    pause
)
