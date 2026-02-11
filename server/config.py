"""
CandyConnect Server - Configuration
"""
import os, secrets

# ── Paths ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("CC_DATA_DIR", "/opt/candyconnect")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
LOG_DIR = os.path.join(DATA_DIR, "logs")
CORE_DIR = os.path.join(DATA_DIR, "cores")

# ── Redis ──
REDIS_URL = os.environ.get("CC_REDIS_URL", "redis://127.0.0.1:6379/0")

# ── JWT ──
JWT_SECRET = os.environ.get("CC_JWT_SECRET", secrets.token_urlsafe(48))
JWT_ALGORITHM = "HS256"
JWT_ADMIN_EXPIRE_HOURS = 24
JWT_CLIENT_EXPIRE_HOURS = 720  # 30 days

# ── Panel ──
PANEL_PORT = int(os.environ.get("CC_PANEL_PORT", "8443"))
PANEL_PATH = os.environ.get("CC_PANEL_PATH", "/candyconnect")
PANEL_VERSION = "1.4.2"
PANEL_BUILD_DATE = "2026-01-28"

# ── Default Admin ──
DEFAULT_ADMIN_USER = os.environ.get("CC_ADMIN_USER", "admin")
DEFAULT_ADMIN_PASS = os.environ.get("CC_ADMIN_PASS", "admin123")

# ── Protocols ──
SUPPORTED_PROTOCOLS = [
    "v2ray", "wireguard", "openvpn", "ikev2", "l2tp", "dnstt",
    "slipstream", "trusttunnel",
]
