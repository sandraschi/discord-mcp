@echo off
REM Stop discord-mcp fleet ports
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0webapp\stop.ps1"
if errorlevel 1 pause

