<# 
═══════════════════════════════════════════════════════════
 CandyConnect - Docker Run Script (Windows PowerShell)
 Usage:
   .\docker-run.ps1              # Build & start
   .\docker-run.ps1 stop         # Stop all containers
   .\docker-run.ps1 logs         # View live logs
   .\docker-run.ps1 restart      # Restart all services
   .\docker-run.ps1 rebuild      # Full rebuild from scratch
   .\docker-run.ps1 status       # Show container status
   .\docker-run.ps1 shell        # Open shell in server container
═══════════════════════════════════════════════════════════
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "logs", "restart", "rebuild", "status", "shell")]
    [string]$Action = "start"
)

$ErrorActionPreference = "Stop"

function Write-Banner {
    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║       🍬 CandyConnect VPN 🍬      ║" -ForegroundColor Cyan
    Write-Host "  ║          Docker Launcher           ║" -ForegroundColor Cyan
    Write-Host "  ╚═══════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Test-DockerRunning {
    try {
        $null = docker info 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
    } catch {
        Write-Host "[ERROR] Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
        exit 1
    }
}

function Ensure-Env {
    if (-not (Test-Path ".env")) {
        Write-Host "[!] No .env file found. Creating with defaults..." -ForegroundColor Yellow
        
        # Generate a random JWT secret
        $bytes = New-Object byte[] 48
        [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
        $jwtSecret = [Convert]::ToBase64String($bytes)

        $envContent = @"
CC_PANEL_PORT=8443
CC_PANEL_PATH=/candyconnect
CC_ADMIN_USER=admin
CC_ADMIN_PASS=admin123
CC_JWT_SECRET=$jwtSecret
CC_REDIS_URL=redis://redis:6379/0
"@
        Set-Content -Path ".env" -Value $envContent -Encoding UTF8 -NoNewline
        Write-Host "[✓] .env file created" -ForegroundColor Green
    }
}

function Get-ComposeCmd {
    # Try 'docker compose' (v2) first, then fall back to 'docker-compose'
    try {
        $null = docker compose version 2>&1
        if ($LASTEXITCODE -eq 0) { return "docker compose" }
    } catch {}
    
    try {
        $null = Get-Command docker-compose -ErrorAction Stop
        return "docker-compose"
    } catch {
        Write-Host "[ERROR] Neither 'docker compose' nor 'docker-compose' found." -ForegroundColor Red
        exit 1
    }
}

function Get-PanelPort {
    if (Test-Path ".env") {
        $portLine = Get-Content ".env" | Where-Object { $_ -match "^CC_PANEL_PORT=" }
        if ($portLine) {
            return ($portLine -split "=")[1].Trim()
        }
    }
    return "8443"
}

function Invoke-Compose {
    param([string[]]$Args)
    $cmd = Get-ComposeCmd
    $fullCmd = "$cmd $($Args -join ' ')"
    Invoke-Expression $fullCmd
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Command failed: $fullCmd" -ForegroundColor Red
    }
}

function Start-CandyConnect {
    Write-Banner
    Test-DockerRunning
    Ensure-Env
    
    Write-Host "[i] Building and starting CandyConnect..." -ForegroundColor Cyan
    Invoke-Compose @("up", "-d", "--build")
    
    $port = Get-PanelPort
    Write-Host ""
    Write-Host "[✓] CandyConnect is running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Panel:   http://localhost:$port/candyconnect" -ForegroundColor White
    Write-Host "  API:     http://localhost:$port/api" -ForegroundColor White
    Write-Host "  Health:  http://localhost:$port/health" -ForegroundColor White
    Write-Host ""
    Write-Host "  ⚠  Change the default password immediately!" -ForegroundColor Yellow
    Write-Host ""
}

function Stop-CandyConnect {
    Test-DockerRunning
    Write-Host "[i] Stopping CandyConnect..." -ForegroundColor Cyan
    Invoke-Compose @("down")
    Write-Host "[✓] Stopped" -ForegroundColor Green
}

function Show-Logs {
    Test-DockerRunning
    Invoke-Compose @("logs", "-f", "--tail=100")
}

function Restart-CandyConnect {
    Test-DockerRunning
    Write-Host "[i] Restarting CandyConnect..." -ForegroundColor Cyan
    Invoke-Compose @("restart")
    Write-Host "[✓] Restarted" -ForegroundColor Green
}

function Rebuild-CandyConnect {
    Test-DockerRunning
    Write-Host "[i] Rebuilding from scratch..." -ForegroundColor Cyan
    Invoke-Compose @("down")
    Invoke-Compose @("build", "--no-cache")
    Invoke-Compose @("up", "-d")
    Write-Host "[✓] Rebuilt and started" -ForegroundColor Green
}

function Show-Status {
    Test-DockerRunning
    Invoke-Compose @("ps")
}

function Open-Shell {
    Test-DockerRunning
    docker exec -it candyconnect-server /bin/bash
}

# ── Main ──
switch ($Action) {
    "start"   { Start-CandyConnect }
    "stop"    { Stop-CandyConnect }
    "logs"    { Show-Logs }
    "restart" { Restart-CandyConnect }
    "rebuild" { Rebuild-CandyConnect }
    "status"  { Show-Status }
    "shell"   { Open-Shell }
}
