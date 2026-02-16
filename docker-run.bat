@echo off
REM ═══════════════════════════════════════════════════════════
REM  CandyConnect - Docker Run Script (Windows CMD)
REM  Usage:
REM    docker-run.bat              Build ^& start
REM    docker-run.bat stop         Stop all containers
REM    docker-run.bat logs         View live logs
REM    docker-run.bat restart      Restart all services
REM    docker-run.bat rebuild      Full rebuild from scratch
REM    docker-run.bat status       Show container status
REM    docker-run.bat shell        Open shell in server container
REM ═══════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

REM Check if Docker is running
docker info >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

if "%1"=="" goto :start
if "%1"=="start" goto :start
if "%1"=="stop" goto :stop
if "%1"=="logs" goto :logs
if "%1"=="restart" goto :restart
if "%1"=="rebuild" goto :rebuild
if "%1"=="status" goto :status
if "%1"=="shell" goto :shell
goto :usage

:start
echo.
echo   ╔═══════════════════════════════════╗
echo   ║       CandyConnect VPN            ║
echo   ║       Docker Launcher             ║
echo   ╚═══════════════════════════════════╝
echo.

REM Create .env if it doesn't exist
if not exist ".env" (
    echo [!] No .env file found. Creating with defaults...
    (
        echo CC_PANEL_PORT=8443
        echo CC_PANEL_PATH=/candyconnect
        echo CC_ADMIN_USER=admin
        echo CC_ADMIN_PASS=admin123
        echo CC_JWT_SECRET=change-me-to-a-random-string
        echo CC_REDIS_URL=redis://redis:6379/0
    ) > .env
    echo [OK] .env file created - PLEASE edit CC_JWT_SECRET!
)

echo [i] Building and starting CandyConnect...
docker compose up -d --build 2>nul

if !errorlevel! neq 0 (
    echo [!] 'docker compose' failed, trying 'docker-compose'...
    docker-compose up -d --build
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to start. Check Docker installation.
        pause
        exit /b 1
    )
)

echo.
echo [OK] CandyConnect is running!
echo.
echo   Panel:   http://localhost:8443/candyconnect
echo   API:     http://localhost:8443/api
echo   Health:  http://localhost:8443/health
echo.
echo   WARNING: Change the default password immediately!
echo.
goto :eof

:stop
echo [i] Stopping CandyConnect...
docker compose down 2>nul || docker-compose down
echo [OK] Stopped
goto :eof

:logs
docker compose logs -f --tail=100 2>nul || docker-compose logs -f --tail=100
goto :eof

:restart
echo [i] Restarting CandyConnect...
docker compose restart 2>nul || docker-compose restart
echo [OK] Restarted
goto :eof

:rebuild
echo [i] Rebuilding from scratch...
docker compose down 2>nul || docker-compose down
docker compose build --no-cache 2>nul || docker-compose build --no-cache
docker compose up -d 2>nul || docker-compose up -d
echo [OK] Rebuilt and started
goto :eof

:status
docker compose ps 2>nul || docker-compose ps
goto :eof

:shell
docker exec -it candyconnect-server /bin/bash
goto :eof

:usage
echo Usage: %~nx0 {start^|stop^|logs^|restart^|rebuild^|status^|shell}
goto :eof
