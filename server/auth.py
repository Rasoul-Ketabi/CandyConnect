"""
CandyConnect Server - JWT Authentication
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import JWT_SECRET, JWT_ALGORITHM, JWT_ADMIN_EXPIRE_HOURS, JWT_CLIENT_EXPIRE_HOURS

security = HTTPBearer()


def create_admin_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_ADMIN_EXPIRE_HOURS)
    payload = {
        "sub": username,
        "role": "admin",
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_client_token(username: str, client_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_CLIENT_EXPIRE_HOURS)
    payload = {
        "sub": username,
        "client_id": client_id,
        "role": "client",
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = decode_token(credentials.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


async def require_client(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = decode_token(credentials.credentials)
    if payload.get("role") != "client":
        raise HTTPException(status_code=403, detail="Client access required")
    return payload


async def require_any_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return decode_token(credentials.credentials)
