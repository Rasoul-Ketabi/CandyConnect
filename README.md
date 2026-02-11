# 🍬 CandyConnect VPN

A full-stack, multi-protocol VPN management platform with a server backend, web admin panel, and desktop client application.

![License](https://img.shields.io/badge/license-MIT-orange)
![Version](https://img.shields.io/badge/version-1.4.2-blue)
![Platform](https://img.shields.io/badge/platform-Linux-green)

---

## 📋 Overview

CandyConnect is an all-in-one VPN server management system that supports multiple VPN protocols from a single control plane:

| Protocol | Engine | Status |
|---|---|---|
| **V2Ray / Xray** | VLESS, VMess, Trojan, Shadowsocks | ✅ Full |
| **WireGuard** | Native kernel module | ✅ Full |
| **OpenVPN** | OpenVPN + Easy-RSA PKI | ✅ Full |
| **IKEv2/IPSec** | strongSwan | ✅ Full |
| **L2TP/IPSec** | xl2tpd + strongSwan | ✅ Full |
| **DNSTT** | DNS tunnel + SSH | ✅ Full |
| **SlipStream** | — | 🔜 Planned |
| **TrustTunnel** | — | 🔜 Planned |

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                  CandyConnect Server                │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Panel API│  │Client API│  │ Protocol Managers │  │
│  │  /api/*  │  │/client-  │  │  WG · V2Ray · OV │  │
│  │          │  │  api/*   │  │  IKE · L2TP · DNS│  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                 │            │
│       └──────┬───────┘                 │            │
│              │                         │            │
│       ┌──────▼──────┐          ┌───────▼────────┐   │
│       │  FastAPI    │          │  System Cores  │   │
│       │  + Redis    │          │  (installed on │   │
│       │  + JWT Auth │          │   the server)  │   │
│       └─────────────┘          └────────────────┘   │
└─────────────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
┌───────────────┐            ┌──────────────────┐
│  Web Panel    │            │  Desktop Client  │
│  (React+Vite) │            │  (Tauri+React)   │
└───────────────┘            └──────────────────┘
```

---

## 🚀 Quick Installation

### Requirements

- **OS:** Ubuntu 20.04+ / Debian 11+ (x86_64)
- **RAM:** Minimum 1 GB (2 GB recommended)
- **Disk:** Minimum 5 GB free space
- **Access:** Root privileges
- **Ports:** 8443 (panel), plus VPN protocol ports

### One-Line Install

```bash
git clone https://github.com/AmiRCandy/CandyConnect.git
cd CandyConnect
sudo bash install.sh
```

The installer will:
1. Install system dependencies (Python, Redis, Node.js)
2. Set up the Python backend with virtual environment
3. Build the web panel frontend
4. Generate JWT secrets
5. Configure firewall rules & IP forwarding
6. Create and start a systemd service

### Post-Installation

After installation completes, you'll see:

```
═══════════════════════════════════════════
  🍬 CandyConnect Installed Successfully!
═══════════════════════════════════════════

  Panel URL:    http://<SERVER_IP>:8443/candyconnect
  API URL:      http://<SERVER_IP>:8443/api
  Client API:   http://<SERVER_IP>:8443/client-api
  Admin User:   admin
  Admin Pass:   admin123

  ⚠  Change the default password immediately!
```

---

## 🖥️ Web Panel

The admin web panel provides full server management:

- **Dashboard** — Server resources, VPN core status, active connections, live logs
- **Clients** — Create, edit, delete VPN users with per-protocol access control, traffic limits, and time limits
- **Core Configs** — Configure each VPN protocol (ports, ciphers, keys, interfaces, etc.)
- **Panel Configs** — Change panel port/path, admin password, view server info

### Access

Open `http://<SERVER_IP>:8443/candyconnect` in your browser.

Default credentials:
- **Username:** `admin`
- **Password:** `admin123`

---

## 📱 Desktop Client

The CandyConnect desktop client (built with Tauri + React) connects to the server backend.

### How It Works

1. User enters the server address (e.g., `http://your-server:8443`)
2. Logs in with their client username/password (created via the web panel)
3. The client fetches available VPN protocols and connection configs
4. User selects a protocol and connects

### Building the Client

```bash
cd client
npm install
npm run dev          # Development mode
npm run build        # Production build (Tauri)
```

> **Note:** Building the Tauri desktop app requires Rust and platform-specific dependencies. See [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/).

---

## 🔧 Server Management

### Service Commands

```bash
# Check status
sudo systemctl status candyconnect

# Restart
sudo systemctl restart candyconnect

# View live logs
sudo journalctl -u candyconnect -f

# Stop
sudo systemctl stop candyconnect
```

### Configuration

Server configuration is stored in `/opt/candyconnect/.env`:

```env
CC_DATA_DIR=/opt/candyconnect
CC_REDIS_URL=redis://127.0.0.1:6379/0
CC_JWT_SECRET=<auto-generated>
CC_PANEL_PORT=8443
CC_PANEL_PATH=/candyconnect
CC_ADMIN_USER=admin
CC_ADMIN_PASS=admin123
```

### File Structure

```
/opt/candyconnect/
├── server/          # Python backend
│   ├── main.py      # FastAPI application
│   ├── config.py    # Configuration
│   ├── database.py  # Redis data layer
│   ├── auth.py      # JWT authentication
│   ├── system_info.py
│   ├── protocols/   # VPN protocol managers
│   │   ├── base.py
│   │   ├── wireguard.py
│   │   ├── v2ray.py
│   │   ├── openvpn.py
│   │   ├── ikev2.py
│   │   ├── l2tp.py
│   │   ├── dnstt.py
│   │   └── manager.py
│   └── routes/      # API endpoints
│       ├── panel_api.py    # Web panel API
│       └── client_api.py   # Client app API
├── web-panel/       # Built panel frontend
├── cores/           # Installed VPN binaries
├── backups/         # Auto-backups
├── logs/            # Server logs
└── .env             # Configuration
```

---

## 🌐 API Reference

### Panel API (`/api`)

All endpoints require admin JWT token via `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Admin login → returns JWT token |
| `GET` | `/api/dashboard` | Server info, cores, stats, logs |
| `GET` | `/api/clients` | List all clients |
| `POST` | `/api/clients` | Create a new client |
| `PUT` | `/api/clients/{id}` | Update a client |
| `DELETE` | `/api/clients/{id}` | Delete a client |
| `GET` | `/api/cores` | List all VPN cores with status |
| `POST` | `/api/cores/{id}/start` | Start a VPN core |
| `POST` | `/api/cores/{id}/stop` | Stop a VPN core |
| `POST` | `/api/cores/{id}/restart` | Restart a VPN core |
| `POST` | `/api/cores/{id}/install` | Install a VPN core |
| `GET` | `/api/configs` | Get all core configurations |
| `PUT` | `/api/configs/{section}` | Update a core configuration |
| `GET` | `/api/logs` | Get server logs |
| `GET` | `/api/panel` | Get panel info |
| `PUT` | `/api/panel` | Update panel settings |
| `PUT` | `/api/panel/password` | Change admin password |
| `POST` | `/api/panel/restart` | Restart the panel |

### Client API (`/client-api`)

Client endpoints use client JWT token.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/client-api/auth/login` | Client login → token + account info |
| `GET` | `/client-api/account` | Get account details |
| `GET` | `/client-api/protocols` | List available protocols |
| `GET` | `/client-api/configs` | Get all VPN configs for user |
| `GET` | `/client-api/configs/{protocol}` | Get specific protocol config |
| `POST` | `/client-api/connect` | Report connection event |
| `POST` | `/client-api/traffic` | Report traffic usage |
| `GET` | `/client-api/server` | Get server info |

### Health Check

```bash
curl http://<SERVER_IP>:8443/health
# {"status": "ok", "version": "1.4.2", "timestamp": 1739281218}
```

---

## 🔑 VPN Protocol Setup

After installation, VPN protocols need to be installed and started via the web panel or API:

### Via Web Panel

1. Go to **Core Configs**
2. Configure each protocol's settings
3. Click **Save Config**
4. Use the **Restart Service** button (or install first if not yet installed)

### Via API

```bash
TOKEN="your-admin-jwt-token"
SERVER="http://your-server:8443"

# Install WireGuard
curl -X POST "$SERVER/api/cores/wireguard/install" \
  -H "Authorization: Bearer $TOKEN"

# Start WireGuard  
curl -X POST "$SERVER/api/cores/wireguard/start" \
  -H "Authorization: Bearer $TOKEN"

# Install & start all protocols
for proto in v2ray wireguard openvpn ikev2 l2tp dnstt; do
  curl -X POST "$SERVER/api/cores/$proto/install" -H "Authorization: Bearer $TOKEN"
  curl -X POST "$SERVER/api/cores/$proto/start" -H "Authorization: Bearer $TOKEN"
done
```

---

## 👥 Client Management

### Creating a Client

Via the web panel:
1. Go to **Clients** → **Add Client**
2. Set username, password, traffic limit, time limit
3. Select which VPN protocols the client can access
4. Click **Create**

Via API:
```bash
curl -X POST "$SERVER/api/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "password": "SecurePass123!",
    "comment": "John Doe",
    "enabled": true,
    "traffic_limit": {"value": 50, "unit": "GB"},
    "time_limit": {"mode": "days", "value": 30, "on_hold": false},
    "protocols": {
      "v2ray": true, "wireguard": true, "openvpn": true,
      "ikev2": true, "l2tp": false, "dnstt": false,
      "slipstream": false, "trusttunnel": false
    }
  }'
```

### Client Features

- **Traffic Limits** — Per-client data caps in GB or MB
- **Time Limits** — Expiry in days or months
- **On Hold** — Pause a client's timer
- **Per-Protocol Access** — Enable/disable individual VPN protocols
- **Traffic Tracking** — Per-protocol usage tracking
- **Connection History** — IP, protocol, duration logging

---

## 🏗️ Development

### Project Structure

```
CandyConnect/
├── server/              # Python FastAPI backend
├── web-panel/           # React + Vite + Tailwind admin panel
├── client/              # Tauri + React desktop VPN client
├── install.sh           # Deployment script
└── README.md
```

### Running in Development

**Server:**
```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Requires Redis running locally
python main.py
```

**Web Panel:**
```bash
cd web-panel
npm install
npm run dev
# Opens at http://localhost:5174
# Proxies /api to http://127.0.0.1:8443
```

**Client:**
```bash
cd client
npm install
npm run dev
```

### Tech Stack

| Component | Technology |
|---|---|
| **Server** | Python 3.10+, FastAPI, Redis, JWT |
| **Web Panel** | React 18, Vite, Tailwind CSS, Lucide Icons |
| **Client** | React 19, Tauri 2, TypeScript, Vite |
| **Database** | Redis |
| **Auth** | JWT (separate admin/client tokens) |

---

## 🔒 Security Notes

- **Change the default admin password** immediately after installation
- All API endpoints are JWT-protected
- Client passwords are stored in Redis (consider encryption for production)
- Admin password is bcrypt-hashed
- Use HTTPS in production (configure SSL in CandyConnect settings)
- Firewall rules are auto-configured during installation

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<p align="center">
  Made with 🍬 by <a href="https://github.com/AmiRCandy">AmiRCandy</a>
</p>
