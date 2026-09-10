@echo off
setlocal
cd /d "%~dp0"
echo Requesting administrator privileges to configure discord-mcp service...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"\"%~dp0scripts\fix-service.ps1\"\"' -Verb RunAs"
