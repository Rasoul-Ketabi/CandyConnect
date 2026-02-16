"""
CandyConnect Server - Client API Router
Endpoints used by the VPN client applications.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import database as db
import auth
from protocols.manager import protocol_manager

router = APIRouter(tags=["client"])

class ClientLoginRequest(BaseModel):
    username: str
    password: str

@router.post("/auth/login")
async def client_login(req: ClientLoginRequest):
    client = await db.verify_client(req.username, req.password)
    if not client:
        raise HTTPException(status_code=401, detail="Invalid username, password or account disabled")
    
    token = auth.create_client_token(req.username, client["id"])
    return {"success": True, "message": "Login successful", "token": token}

@router.get("/me")
async def get_my_info(payload=Depends(auth.require_client)):
    client_id = payload.get("client_id")
    client = await db.get_client(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get server IP (best effort)
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        server_ip = s.getsockname()[0]
        s.close()
    except Exception:
        server_ip = "127.0.0.1"

    # Fetch all enabled VPN configs for this user
    vpn_configs = await protocol_manager.get_client_configs(
        client["username"], server_ip, client["protocols"], client.get("protocol_data", {})
    )
    
    return {
        "success": True,
        "message": "User info fetched",
        "data": {
            "username": client["username"],
            "traffic_used": client["traffic_used"],
            "traffic_limit": client["traffic_limit"],
            "expires_at": client["expires_at"],
            "vpn_configs": vpn_configs
        }
    }

@router.get("/ping")
async def ping():
    return {"success": True, "message": "client pong"}
