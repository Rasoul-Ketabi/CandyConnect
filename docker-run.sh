#!/bin/bash
# ═══════════════════════════════════════════════════════════
# CandyConnect - Docker Run Script (Linux / macOS)
# Usage:
#   ./docker-run.sh          # Build & start in background
#   ./docker-run.sh stop     # Stop all containers
#   ./docker-run.sh logs     # View live logs
#   ./docker-run.sh restart  # Restart all services
#   ./docker-run.sh rebuild  # Full rebuild from scratch
#   ./docker-run.sh status   # Show container status
#   ./docker-run.sh shell    # Open shell in server container
# ═══════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

COMPOSE_CMD="docker compose"
# Fallback to docker-compose if docker compose is not available
if ! $COMPOSE_CMD version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
fi

banner() {
    echo -e "${BOLD}${CYAN}"
    echo "  ╔═══════════════════════════════════╗"
    echo "  ║       🍬 CandyConnect VPN 🍬      ║"
    echo "  ║          Docker Launcher           ║"
    echo "  ╚═══════════════════════════════════╝"
    echo -e "${NC}"
}

# Generate .env file if it doesn't exist
ensure_env() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}[!]${NC} No .env file found. Creating with defaults..."
        JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null || openssl rand -base64 48)
        cat > .env << EOF
CC_PANEL_PORT=8443
CC_PANEL_PATH=/candyconnect
CC_ADMIN_USER=admin
CC_ADMIN_PASS=admin123
CC_JWT_SECRET=${JWT_SECRET}
EOF
        echo -e "${GREEN}[✓]${NC} .env file created"
    fi
}

start() {
    banner
    ensure_env
    echo -e "${CYAN}[i]${NC} Building and starting CandyConnect..."
    $COMPOSE_CMD up -d --build
    echo ""
    echo -e "${GREEN}[✓]${NC} CandyConnect is running!"
    echo ""
    
    # Read port from env or default
    PORT=$(grep -oP 'CC_PANEL_PORT=\K.*' .env 2>/dev/null || echo "8443")
    echo -e "  ${BOLD}Panel:${NC}   http://localhost:${PORT}/candyconnect"
    echo -e "  ${BOLD}API:${NC}     http://localhost:${PORT}/api"
    echo -e "  ${BOLD}Health:${NC}  http://localhost:${PORT}/health"
    echo ""
    echo -e "  ${YELLOW}⚠  Change the default password immediately!${NC}"
    echo ""
}

stop() {
    echo -e "${CYAN}[i]${NC} Stopping CandyConnect..."
    $COMPOSE_CMD down
    echo -e "${GREEN}[✓]${NC} Stopped"
}

logs() {
    $COMPOSE_CMD logs -f --tail=100
}

restart() {
    echo -e "${CYAN}[i]${NC} Restarting CandyConnect..."
    $COMPOSE_CMD restart
    echo -e "${GREEN}[✓]${NC} Restarted"
}

rebuild() {
    echo -e "${CYAN}[i]${NC} Rebuilding from scratch..."
    $COMPOSE_CMD down
    $COMPOSE_CMD build --no-cache
    $COMPOSE_CMD up -d
    echo -e "${GREEN}[✓]${NC} Rebuilt and started"
}

status() {
    $COMPOSE_CMD ps
}

open_shell() {
    docker exec -it candyconnect-server /bin/bash
}

# ── Main ──
case "${1:-start}" in
    start)   start ;;
    stop)    stop ;;
    logs)    logs ;;
    restart) restart ;;
    rebuild) rebuild ;;
    status)  status ;;
    shell)   open_shell ;;
    *)
        echo "Usage: $0 {start|stop|logs|restart|rebuild|status|shell}"
        exit 1
        ;;
esac
