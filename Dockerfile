# ═══════════════════════════════════════════════════════════
#  CandyConnect - Multi-stage Docker Build
#  Works on Linux, Windows (Docker Desktop), and macOS
# ═══════════════════════════════════════════════════════════

# ── Stage 1: Build the Web Panel ──
FROM node:20-slim AS panel-builder

WORKDIR /build/web-panel

# Copy package files first for better caching
COPY web-panel/package.json web-panel/package-lock.json* ./

RUN npm install --legacy-peer-deps

# Copy the rest of the web panel source
COPY web-panel/ ./

# Build the panel (tsc + vite)
RUN npm run build


# ── Stage 2: Python Server ──
FROM python:3.12-slim

LABEL maintainer="CandyConnect"
LABEL description="CandyConnect VPN Server Panel"

# Install system dependencies needed by protocol managers
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        wget \
        unzip \
        git \
        iptables \
        iproute2 \
        procps \
        sudo \
        openssh-client \
        redis-tools \
    && rm -rf /var/lib/apt/lists/*

# Set up app directory structure (mirrors install.sh layout)
ENV CC_DATA_DIR=/opt/candyconnect
RUN mkdir -p \
    ${CC_DATA_DIR}/server \
    ${CC_DATA_DIR}/web-panel/dist \
    ${CC_DATA_DIR}/cores \
    ${CC_DATA_DIR}/backups \
    ${CC_DATA_DIR}/logs

WORKDIR ${CC_DATA_DIR}/server

# Copy server requirements first for caching
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy server source
COPY server/ ./

# Copy built web panel from Stage 1
COPY --from=panel-builder /build/web-panel/dist/ ${CC_DATA_DIR}/web-panel/dist/

# Environment defaults (can be overridden in docker-compose or .env)
ENV CC_REDIS_URL=redis://redis:6379/0
ENV CC_JWT_SECRET=""
ENV CC_PANEL_PORT=8443
ENV CC_PANEL_PATH=/candyconnect
ENV CC_ADMIN_USER=admin
ENV CC_ADMIN_PASS=admin123

EXPOSE ${CC_PANEL_PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:${CC_PANEL_PORT}/health || exit 1

# Start the server via uvicorn
CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${CC_PANEL_PORT} --log-level info"]
