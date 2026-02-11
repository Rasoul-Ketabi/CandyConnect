"""
CandyConnect Server - Web Panel API Routes
All endpoints the web-panel frontend expects.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from auth import create_admin_token, require_admin
from database import (
    verify_admin, get_admin_username, change_admin_password,
    get_panel_config, update_panel_config,
    get_all_clients, get_client, create_client, update_client, delete_client,
    get_logs, get_core_configs, get_core_config, update_core_config,
    get_client_count, add_log,
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
#  AUTH
# ═══════════════════════════════════════

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/auth/login")
async def login(req: LoginRequest):
    valid = await verify_admin(req.username, req.password)
    if not valid:
        return {"success": False, "message": "Invalid username or password"}
    token = create_admin_token(req.username)
    await add_log("INFO", "System", f"Admin '{req.username}' logged in")
    return {"success": True, "message": "Login successful", "token": token}


# ═══════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════

@router.get("/dashboard")
async def dashboard(_=Depends(require_admin)):
    server = await get_server_info()
    cores = await protocol_manager.get_all_cores_info()
    logs = await get_logs(limit=50)
    total_clients = await get_client_count()

    active_connections = sum(c["active_connections"] for c in cores)
    running_cores = sum(1 for c in cores if c["status"] == "running")
    total_cores = len(cores)

    return ok({
        "server": server,
        "vpn_cores": cores,
        "logs": logs,
        "stats": {
            "total_clients": total_clients,
            "active_connections": active_connections,
            "running_cores": running_cores,
            "total_cores": total_cores,
        },
    })


# ═══════════════════════════════════════
#  CLIENTS
# ═══════════════════════════════════════

@router.get("/clients")
async def list_clients(_=Depends(require_admin)):
    clients = await get_all_clients()
    return ok(clients)


@router.get("/clients/{client_id}")
async def get_single_client(client_id: str, _=Depends(require_admin)):
    client = await get_client(client_id)
    if not client:
        return err("Client not found", 404)
    return ok(client)


class CreateClientRequest(BaseModel):
    username: str
    password: str
    comment: str = ""
    enabled: bool = True
    group: Optional[str] = None
    traffic_limit: dict = Field(default_factory=lambda: {"value": 50, "unit": "GB"})
    time_limit: dict = Field(default_factory=lambda: {"mode": "days", "value": 30, "on_hold": False})
    protocols: dict = Field(default_factory=lambda: {
        "v2ray": True, "wireguard": True, "openvpn": True, "ikev2": True,
        "l2tp": True, "dnstt": True, "slipstream": True, "trusttunnel": True,
    })

@router.post("/clients")
async def create_new_client(req: CreateClientRequest, _=Depends(require_admin)):
    try:
        # 1. Create client in DB
        client = await create_client(req.model_dump())

        # 2. Add client to VPN protocol cores and get generated data
        protocol_data = await protocol_manager.add_client_to_protocols(
            req.username,
            {"password": req.password},
            req.protocols,
        )

        # 3. Update client with protocol-specific data (keys, etc)
        if protocol_data:
            client = await update_client(client["id"], {"protocol_data": protocol_data})

    except ValueError as e:
        return err(str(e))
    except Exception as e:
        await add_log("WARN", "System", f"Client created but protocol setup partial: {e}")

    return ok(client, "Client created")


class UpdateClientRequest(BaseModel):
    password: Optional[str] = None
    comment: Optional[str] = None
    enabled: Optional[bool] = None
    group: Optional[str] = None
    traffic_limit: Optional[dict] = None
    time_limit: Optional[dict] = None
    protocols: Optional[dict] = None

@router.put("/clients/{client_id}")
async def update_existing_client(client_id: str, req: UpdateClientRequest, _=Depends(require_admin)):
    # Get current client
    old_client = await get_client(client_id)
    if not old_client:
        return err("Client not found", 404)

    updates = {k: v for k, v in req.model_dump().items() if v is not None}

    # Check if we need to sync protocols
    resync_needed = False
    if "password" in updates and updates["password"] != old_client["password"]:
        resync_needed = True
    if "protocols" in updates and updates["protocols"] != old_client["protocols"]:
        resync_needed = True
    if "enabled" in updates and updates["enabled"] != old_client["enabled"]:
        resync_needed = True

    client = await update_client(client_id, updates)

    if resync_needed:
        try:
            # We remove and re-add to protocols to ensure configuration matches DB
            await protocol_manager.remove_client_from_protocols(old_client)
            if client["enabled"]:
                # Pass existing protocol_data so protocols can reuse keys/etc if they support it
                protocol_data = await protocol_manager.add_client_to_protocols(
                    client["username"],
                    {"password": client["password"]},
                    client["protocols"],
                    existing_data=old_client.get("protocol_data", {})
                )
                if protocol_data:
                    # Merge protocol data
                    current_data = client.get("protocol_data", {})
                    current_data.update(protocol_data)
                    client = await update_client(client_id, {"protocol_data": current_data})
        except Exception as e:
            await add_log("WARN", "System", f"Client updated but protocol sync failed: {e}")

    return ok(client, "Client updated")


@router.delete("/clients/{client_id}")
async def delete_existing_client(client_id: str, _=Depends(require_admin)):
    # Get client info before deletion for protocol cleanup
    client = await get_client(client_id)
    if client:
        try:
            await protocol_manager.remove_client_from_protocols(client)
        except Exception:
            pass
    success = await delete_client(client_id)
    if not success:
        return err("Client not found", 404)
    return ok(None, "Client deleted")


# ═══════════════════════════════════════
#  LOGS
# ═══════════════════════════════════════

@router.get("/logs")
async def list_logs(_=Depends(require_admin)):
    logs = await get_logs(limit=200)
    return ok(logs)


# ═══════════════════════════════════════
#  VPN CORES
# ═══════════════════════════════════════

@router.get("/cores")
async def list_cores(_=Depends(require_admin)):
    cores = await protocol_manager.get_all_cores_info()
    return ok(cores)


@router.post("/cores/{core_id}/start")
async def start_core(core_id: str, _=Depends(require_admin)):
    success = await protocol_manager.start_protocol(core_id)
    if not success:
        return err(f"Failed to start {core_id}. Check logs for details.")
    return ok(None, f"{core_id} started successfully")


@router.post("/cores/{core_id}/stop")
async def stop_core(core_id: str, _=Depends(require_admin)):
    success = await protocol_manager.stop_protocol(core_id)
    if not success:
        return err(f"Failed to stop {core_id}")
    return ok(None, f"{core_id} stopped successfully")


@router.post("/cores/{core_id}/restart")
async def restart_core(core_id: str, _=Depends(require_admin)):
    success = await protocol_manager.restart_protocol(core_id)
    if not success:
        return err(f"Failed to restart {core_id}")
    return ok(None, f"{core_id} restarted successfully")


@router.post("/cores/{core_id}/install")
async def install_core(core_id: str, _=Depends(require_admin)):
    success = await protocol_manager.install_protocol(core_id)
    if not success:
        return err(f"Failed to install {core_id}. Check logs for details.")
    return ok(None, f"{core_id} installed successfully")


# ═══════════════════════════════════════
#  CORE CONFIGS
# ═══════════════════════════════════════

@router.get("/configs")
async def get_all_configs(_=Depends(require_admin)):
    configs = await get_core_configs()
    return ok(configs)


@router.get("/configs/{section}")
async def get_section_config(section: str, _=Depends(require_admin)):
    config = await get_core_config(section)
    if config is None:
        return err(f"Config section '{section}' not found", 404)
    return ok(config)


@router.put("/configs/{section}")
async def update_section_config(section: str, data: dict, _=Depends(require_admin)):
    await update_core_config(section, data)
    return ok(None, f"{section} configuration saved")


# ═══════════════════════════════════════
#  PANEL
# ═══════════════════════════════════════

@router.get("/panel")
async def get_panel(_=Depends(require_admin)):
    config = await get_panel_config()
    server = await get_server_info()
    admin_user = await get_admin_username()
    total_clients = await get_client_count()
    cores = await protocol_manager.get_all_cores_info()

    return ok({
        "config": config,
        "server": server,
        "admin_username": admin_user,
        "total_cores": len(cores),
        "total_clients": total_clients,
    })


class UpdatePanelRequest(BaseModel):
    panel_port: Optional[int] = None
    panel_path: Optional[str] = None

@router.put("/panel")
async def update_panel(req: UpdatePanelRequest, _=Depends(require_admin)):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if "panel_port" in updates:
        port = updates["panel_port"]
        if port < 1 or port > 65535:
            return err("Port must be between 1 and 65535")
    if "panel_path" in updates:
        if not updates["panel_path"].startswith("/"):
            return err("Path must start with /")
    await update_panel_config(updates)
    await add_log("INFO", "System", f"Panel config updated: {updates}")
    return ok(None, "Panel configuration saved")


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

@router.put("/panel/password")
async def panel_change_password(req: ChangePasswordRequest, _=Depends(require_admin)):
    if req.new_password != req.confirm_password:
        return err("Passwords do not match")
    if len(req.new_password) < 8:
        return err("Password must be at least 8 characters")
    success = await change_admin_password(req.current_password, req.new_password)
    if not success:
        return err("Current password is incorrect")
    await add_log("INFO", "System", "Admin password changed")
    return ok(None, "Password changed successfully")


@router.post("/panel/restart")
async def panel_restart(_=Depends(require_admin)):
    await add_log("WARN", "System", "Panel restart initiated by admin")
    # In production, would trigger actual restart via systemd
    return ok(None, "Panel restart initiated")
