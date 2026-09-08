# Per-repo fleet start config for discord-mcp
# Edit ports/backend target here - start.ps1 is fleet-standard.
@{
    Name         = 'discord-mcp'
    BackendPort  = 10756
    FrontendPort = 10757
    HealthPath   = '/api/v1/health'
    WebRoot      = 'D:\Dev\repos\discord-mcp\webapp'
    Backend = @{
        # 'nssm', not 'uvicorn' -- this backend runs as a persistent NSSM
        # Windows service (service name 'discord-mcp', matches Name above),
        # not a process the launcher spawns itself. With Kind='uvicorn' the
        # generic port-conflict path only health-checks an already-running
        # backend when -ReuseIfRunning is explicitly passed; without it,
        # a perfectly healthy NSSM-held port gets reported as "held by
        # Windows/NSSM service and health check failed" and the launcher
        # exits 1 -- looks like an instacrash on a plain double-click, even
        # though nothing is actually wrong. Kind='nssm' routes to
        # Start-FleetNssmWebapp, which always health-checks the service
        # (Test-FleetBackendHealthy) with no extra flag required.
        Kind          = 'nssm'
        UvicornTarget = 'discord_mcp.server:app'
        SyncExtras    = @('dev')
        Env           = @{ WEB_PORT = '10756' }
    }
    Frontend = @{
        Kind           = 'vite-npm'
        PackageManager = 'npm'
        PortEnvVar     = 'VITE_PORT'
        ApiTargetEnv   = 'VITE_API_TARGET'
    }
}
