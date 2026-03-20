# Run from repo root so backend starts correctly
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
& (Join-Path $root "start.ps1")
