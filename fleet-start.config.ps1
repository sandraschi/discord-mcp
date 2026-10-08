# Per-repo fleet start config for discord-mcp
# Edit ports/backend target here - start.ps1 is fleet-standard.
@{
    Name         = 'discord-mcp'
    BackendPort  = 10756
    FrontendPort = 10757
    HealthPath   = '/api/v1/health'
    WebRoot      = 'webapp'
    Backend = @{
        Kind          = 'uvicorn'
        UvicornTarget = 'discord_mcp.server:app'
        SyncExtras    = @('dev')
        SyncOnStart  = $true
        Env           = @{ WEB_PORT = '10756' }
    }
    Frontend = @{
        Kind           = 'vite-npm'
        PackageManager = 'npm'
        PortEnvVar     = 'VITE_PORT'
        ApiTargetEnv   = 'VITE_API_TARGET'
    }
}
