"""
CandyConnect Server - Panel API Router
Defines all endpoints for the web management panel.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel

import database as db
import auth
from config import SUPPORTED_PROTOCOLS
from system_info import get_server_info
from protocols.manager import protocol_manager

router = APIRouter(tags=["panel"])

# ── Auth ──

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/auth/login")
async def login(req: LoginRequest):
    if await db.verify_admin(req.username, req.password):
        token = auth.create_admin_token(req.username)
        return {"success": True, "message": "Login successful", "token": token}
    raise HTTPException(status_code=401, detail="Invalid username or password")

# ── Dashboard ──

@router.get("/dashboard")
async def get_dashboard(user=Depends(auth.require_admin)):
    server_info = await get_server_info()
    vpn_cores = await protocol_manager.get_all_cores_info()
    logs = await db.get_logs(10)
    
    active_connections = sum(c.get("active_connections", 0) for c in vpn_cores)
    running_cores = sum(1 for c in vpn_cores if c.get("status") == "running")
    
    return {
        "success": True,
        "message": "Dashboard data fetched",
        "data": {
            "server": server_info,
            "vpn_cores": vpn_cores,
            "logs": logs,
            "stats": {
                "total_clients": await db.get_client_count(),
                "active_connections": active_connections,
                "running_cores": running_cores,
                "total_cores": len(vpn_cores),
            }
        }
    }

# ── Clients ──

class CreateClientRequest(BaseModel):
    username: str
    password: str
    comment: str = ""
    enabled: bool = True
    group: Optional[str] = None
    traffic_limit: dict
    time_limit: dict
    protocols: dict

class UpdateClientRequest(BaseModel):
    password: Optional[str] = None
    comment: Optional[str] = None
    enabled: Optional[bool] = None
    group: Optional[str] = None
    traffic_limit: Optional[dict] = None
    time_limit: Optional[dict] = None
    protocols: Optional[dict] = None

@router.get("/clients")
async def list_clients(user=Depends(auth.require_admin)):
    clients = await db.get_all_clients()
    return {"success": True, "message": "Clients fetched", "data": clients}

@router.get("/clients/{id}")
async def get_client(id: str, user=Depends(auth.require_admin)):
    client = await db.get_client(id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"success": True, "message": "Client fetched", "data": client}

@router.post("/clients")
async def create_client(req: CreateClientRequest, user=Depends(auth.require_admin)):
    try:
        # Create in DB
        client = await db.create_client(req.model_dump())
        
        # Add to protocol backends
        pdata = await protocol_manager.add_client_to_protocols(
            client["username"], client, client["protocols"]
        )
        
        # Update DB with protocol-specific data (keys, etc)
        await db.update_client(client["id"], {"protocol_data": pdata})
        client["protocol_data"] = pdata
        
        return {"success": True, "message": "Client created", "data": client}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/clients/{id}")
async def update_client(id: str, req: UpdateClientRequest, user=Depends(auth.require_admin)):
    existing = await db.get_client(id)
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")
    
    try:
        updated = await db.update_client(id, req.model_dump(exclude_unset=True))
        
        # Update protocol backends
        pdata = await protocol_manager.add_client_to_protocols(
            updated["username"], updated, updated["protocols"], 
            existing_data=updated.get("protocol_data")
        )
        await db.update_client(id, {"protocol_data": pdata})
        updated["protocol_data"] = pdata
        
        return {"success": True, "message": "Client updated", "data": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/clients/{id}")
async def delete_client(id: str, user=Depends(auth.require_admin)):
    client = await db.get_client(id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    await protocol_manager.remove_client_from_protocols(client)
    await db.delete_client(id)
    return {"success": True, "message": "Client deleted"}

# ── Logs ──

@router.get("/logs")
async def get_logs(limit: int = 100, user=Depends(auth.require_admin)):
    logs = await db.get_logs(limit)
    return {"success": True, "message": "Logs fetched", "data": logs}

# ── VPN Cores ──

@router.get("/cores")
async def get_cores(user=Depends(auth.require_admin)):
    cores = await protocol_manager.get_all_cores_info()
    return {"success": True, "message": "Cores fetched", "data": cores}

@router.post("/cores/{id}/start")
async def start_core(id: str, user=Depends(auth.require_admin)):
    success = await protocol_manager.start_protocol(id)
    if success:
        return {"success": True, "message": f"{id.upper()} started"}
    raise HTTPException(status_code=500, detail=f"Failed to start {id}")

@router.post("/cores/{id}/stop")
async def stop_core(id: str, user=Depends(auth.require_admin)):
    success = await protocol_manager.stop_protocol(id)
    if success:
        return {"success": True, "message": f"{id.upper()} stopped"}
    raise HTTPException(status_code=500, detail=f"Failed to stop {id}")

@router.post("/cores/{id}/restart")
async def restart_core(id: str, user=Depends(auth.require_admin)):
    success = await protocol_manager.restart_protocol(id)
    if success:
        return {"success": True, "message": f"{id.upper()} restarted"}
    raise HTTPException(status_code=500, detail=f"Failed to restart {id}")

# ── Core Configs ──

@router.get("/configs")
async def get_configs(user=Depends(auth.require_admin)):
    configs = await db.get_core_configs()
    return {"success": True, "message": "Configs fetched", "data": configs}

@router.put("/configs/{section}")
async def update_config(section: str, data: dict = Body(...), user=Depends(auth.require_admin)):
    await db.update_core_config(section, data)
    return {"success": True, "message": f"Config for {section} updated"}

# ── Panel ──

@router.get("/panel")
async def get_panel_info(user=Depends(auth.require_admin)):
    config = await db.get_panel_config()
    server = await get_server_info()
    admin_user = await db.get_admin_username()
    
    return {
        "success": True,
        "message": "Panel info fetched",
        "data": {
            "config": config,
            "server": server,
            "admin_username": admin_user,
            "total_clients": await db.get_client_count(),
            "total_cores": len(SUPPORTED_PROTOCOLS)
        }
    }

@router.put("/panel")
async def update_panel(data: dict = Body(...), user=Depends(auth.require_admin)):
    await db.update_panel_config(data)
    return {"success": True, "message": "Panel configuration updated"}

class PwdRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

@router.put("/panel/password")
async def change_panel_password(req: PwdRequest, user=Depends(auth.require_admin)):
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    success = await db.change_admin_password(req.current_password, req.new_password)
    if success:
        return {"success": True, "message": "Password changed successfully"}
    raise HTTPException(status_code=400, detail="Incorrect current password")

@router.post("/panel/restart")
async def restart_panel(user=Depends(auth.require_admin)):
    # In Docker, we can just exit and let restart: unless-stopped handle it
    # or just return success and let the user restart the container
    import os, signal
    # Graceful shutdown after returning response
    def shutdown():
        import time
        time.sleep(1)
        os.kill(os.getpid(), signal.SIGTERM)
    
    import threading
    threading.Thread(target=shutdown).start()
    
    return {"success": True, "message": "Panel restarting..."}
