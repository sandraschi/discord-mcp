param(
    [switch]$Headless,
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$NoBrowser
)

$FleetStartPath = Join-Path $Root "scripts\FleetStartMode.ps1"
if (-not (Test-Path -LiteralPath $FleetStartPath)) {
    Write-Host "ERROR: Missing vendored launcher helper: $FleetStartPath" -ForegroundColor Red
    exit 1
}
. $FleetStartPath
$FleetStart = Initialize-FleetStartMode @PSBoundParameters
Enter-FleetHeadlessConsole -Headless:$Headless -BackendOnly:$BackendOnly

$BackendPort = 10756
$FrontendPort = 10757
Stop-FleetPortSquatters -Ports @($BackendPort, $FrontendPort) -Label "discord-mcp"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
& (Join-Path $root "start.ps1") @PSBoundParameters
exit $LASTEXITCODE

