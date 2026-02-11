"""
CandyConnect Server - Client Application API Routes
Endpoints for the desktop/mobile VPN client application.
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from auth import create_client_token, require_client
from database import (
    verify_client, get_client, get_client_by_username,
    record_client_connection, add_log,
    get_core_configs,
)
from system_info import get_server_info
from protocols.manager import protocol_manager

router = APIRouter()


def ok(data=None, message: str = "OK"):
    return {"success": True, "message": message, "data": data}


def err(message: str, code: int = 400):
    raise HTTPException(
        status_code=code,
        detail=message,
        headers={"X-Error": "true"},
    )


# ═══════════════════════════════════════
#  CLIENT AUTH
# ═══════════════════════════════════════

class ClientLoginRequest(BaseModel):
    username: str
    password: str

@router.post("/auth/login")
async def client_login(req: ClientLoginRequest, request: Request):
    client = await verify_client(req.username, req.password)
    if not client:
        await add_log("WARN", "ClientAPI", f"Failed login attempt: {req.username}")
        return {"success": False, "message": "Invalid credentials or account disabled"}

    token = create_client_token(req.username, client["id"])

    # Record connection
    client_ip = request.client.host if request.client else "unknown"
    await record_client_connection(client["id"], client_ip, "login")
    await add_log("INFO", "ClientAPI", f"Client '{req.username}' authenticated from {client_ip}")

    # Get server info
    server = await get_server_info()

    return {
        "success": True,
        "message": "Login successful",
        "token": token,
        "server_info": {
            "hostname": server["hostname"],
            "ip": server["ip"],
            "version": "1.4.2",
        },
        "account": _format_client_account(client),
    }


# ═══════════════════════════════════════
#  CLIENT ACCOUNT INFO
# ═══════════════════════════════════════

@router.get("/account")
async def get_account(payload=Depends(require_client)):
    client = await get_client_by_username(payload["sub"])
    if not client:
        err("Account not found", 404)
    return ok(_format_client_account(client))


# ═══════════════════════════════════════
#  AVAILABLE PROTOCOLS
# ═══════════════════════════════════════

@router.get("/protocols")
async def get_protocols(payload=Depends(require_client)):
    client = await get_client_by_username(payload["sub"])
    if not client:
        err("Account not found", 404)

    cores = await protocol_manager.get_all_cores_info()
    user_protocols = client.get("protocols", {})

    result = []
    for core in cores:
        proto_id = core["id"]
        enabled = user_protocols.get(proto_id, False)
        result.append({
            "id": proto_id,
            "name": core["name"],
            "status": core["status"] if enabled else "stopped",
            "version": core["version"],
            "port": core["port"],
            "active_connections": core["active_connections"],
            "icon": _protocol_icon(proto_id),
            "enabled_for_user": enabled,
        })

    return ok(result)


# ═══════════════════════════════════════
#  VPN CONFIGS FOR CLIENT
# ═══════════════════════════════════════

@router.get("/configs")
async def get_client_vpn_configs(payload=Depends(require_client)):
    """Get all VPN protocol connection configs for the authenticated client."""
    client = await get_client_by_username(payload["sub"])
    if not client:
        err("Account not found", 404)

    server = await get_server_info()
    server_ip = server["ip"]
    user_protocols = client.get("protocols", {})

    configs = await protocol_manager.get_client_configs(
        client["username"],
        server_ip,
        user_protocols,
    )

    return ok(configs)


@router.get("/configs/{protocol_id}")
async def get_client_protocol_config(protocol_id: str, payload=Depends(require_client)):
    """Get VPN config for a specific protocol."""
    client = await get_client_by_username(payload["sub"])
    if not client:
        err("Account not found", 404)

    user_protocols = client.get("protocols", {})
    if not user_protocols.get(protocol_id):
        err(f"You don't have access to {protocol_id}", 403)

    server = await get_server_info()
    proto = protocol_manager.get_protocol(protocol_id)
    if not proto:
        err(f"Protocol {protocol_id} not available", 404)

    config = await proto.get_client_config(client["username"], server["ip"])
    return ok(config)


# ═══════════════════════════════════════
#  CONNECTION TRACKING
# ═══════════════════════════════════════

class ConnectRequest(BaseModel):
    protocol: str

@router.post("/connect")
async def report_connect(req: ConnectRequest, request: Request, payload=Depends(require_client)):
    """Client reports it connected to a protocol (for tracking)."""
    client = await get_client_by_username(payload["sub"])
    if not client:
        err("Account not found", 404)

    client_ip = request.client.host if request.client else "unknown"
    await record_client_connection(client["id"], client_ip, req.protocol)
    await add_log("INFO", req.protocol, f"Client '{payload['sub']}' connected from {client_ip}")
    return ok(None, "Connection recorded")


class TrafficReport(BaseModel):
    protocol: str
    bytes_used: float  # bytes

@router.post("/traffic")
async def report_traffic(req: TrafficReport, payload=Depends(require_client)):
    """Client reports traffic usage."""
    from database import update_client_traffic
    client = await get_client_by_username(payload["sub"])
    if not client:
        err("Account not found", 404)

    await update_client_traffic(client["id"], req.protocol, req.bytes_used)
    return ok(None, "Traffic recorded")


# ═══════════════════════════════════════
#  SERVER INFO
# ═══════════════════════════════════════

@router.get("/server")
async def get_server(payload=Depends(require_client)):
    server = await get_server_info()
    return ok({
        "hostname": server["hostname"],
        "ip": server["ip"],
        "version": "1.4.2",
    })


# ═══════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════

def _format_client_account(client: dict) -> dict:
    """Format client data for the client app."""
    return {
        "username": client["username"],
        "comment": client.get("comment", ""),
        "enabled": client.get("enabled", True),
        "traffic_limit": client.get("traffic_limit", {"value": 50, "unit": "GB"}),
        "traffic_used": client.get("traffic_used", 0),
        "time_limit": client.get("time_limit", {"mode": "days", "value": 30, "on_hold": False}),
        "time_used": client.get("time_used", 0),
        "created_at": client.get("created_at", ""),
        "expires_at": client.get("expires_at", ""),
        "protocols": client.get("protocols", {}),
        "last_connected_ip": client.get("last_connected_ip"),
        "last_connected_time": client.get("last_connected_time"),
        "connection_history": client.get("connection_history", [])[:20],
    }


def _protocol_icon(proto_id: str) -> str:
    return {
        "v2ray": "⚡",
        "wireguard": "🛡️",
        "openvpn": "🔒",
        "ikev2": "🔐",
        "l2tp": "📡",
        "dnstt": "🌐",
        "slipstream": "💨",
        "trusttunnel": "🏰",
    }.get(proto_id, "●")
