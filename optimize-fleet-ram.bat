@echo off
setlocal
cd /d "%~dp0"
echo =======================================================
echo Optimizing Fleet Services RAM (Direct Venv Invocation)
echo =======================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$script = Join-Path $pwd 'scripts\optimize-fleet-ram.ps1'; Start-Process powershell.exe -ArgumentList @('-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', $script) -Verb RunAs"
if errorlevel 1 (
    echo Elevation was cancelled or failed.
    pause
)
