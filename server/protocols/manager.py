"""
CandyConnect - Protocol Manager
Central manager for all VPN protocol cores.
"""
import asyncio, time, logging, psutil
from typing import Optional

from protocols.base import BaseProtocol
from protocols.wireguard import WireGuardProtocol
from protocols.v2ray import V2RayProtocol
from protocols.openvpn import OpenVPNProtocol
from protocols.ikev2 import IKEv2Protocol
from protocols.l2tp import L2TPProtocol
from protocols.dnstt import DNSTTProtocol
from database import (
    get_all_core_statuses, get_core_status, set_core_status,
    add_log, get_core_config, get_all_clients,
)

logger = logging.getLogger("candyconnect")

# Protocol name -> version/port metadata
PROTOCOL_META = {
    "v2ray":       {"name": "V2Ray (Xray)",  "default_port": 443},
    "wireguard":   {"name": "WireGuard",      "default_port": 51820},
    "openvpn":     {"name": "OpenVPN",        "default_port": 1194},
    "ikev2":       {"name": "IKEv2/IPSec",    "default_port": 500},
    "l2tp":        {"name": "L2TP/IPSec",     "default_port": 1701},
    "dnstt":       {"name": "DNSTT",          "default_port": 53},
    "slipstream":  {"name": "SlipStream",     "default_port": 8388},
    "trusttunnel": {"name": "TrustTunnel",    "default_port": 9443},
}


class ProtocolManager:
    """Manages all VPN protocol instances."""

    def __init__(self):
        self._protocols: dict[str, BaseProtocol] = {
            "v2ray": V2RayProtocol(),
            "wireguard": WireGuardProtocol(),
            "openvpn": OpenVPNProtocol(),
            "ikev2": IKEv2Protocol(),
            "l2tp": L2TPProtocol(),
            "dnstt": DNSTTProtocol(),
            # slipstream and trusttunnel: placeholder (not needed now per prompt)
        }
        self._traffic_cache: dict[str, dict] = {}

    def get_protocol(self, protocol_id: str) -> Optional[BaseProtocol]:
        return self._protocols.get(protocol_id)

    async def install_protocol(self, protocol_id: str) -> bool:
        proto = self.get_protocol(protocol_id)
        if not proto:
            await add_log("ERROR", "System", f"Unknown protocol: {protocol_id}")
            return False
        return await proto.install()

    async def start_protocol(self, protocol_id: str) -> bool:
        proto = self.get_protocol(protocol_id)
        if not proto:
            await add_log("ERROR", "System", f"Unknown protocol: {protocol_id}")
            return False
        return await proto.start()

    async def stop_protocol(self, protocol_id: str) -> bool:
        proto = self.get_protocol(protocol_id)
        if not proto:
            await add_log("ERROR", "System", f"Unknown protocol: {protocol_id}")
            return False
        return await proto.stop()

    async def restart_protocol(self, protocol_id: str) -> bool:
        proto = self.get_protocol(protocol_id)
        if not proto:
            await add_log("ERROR", "System", f"Unknown protocol: {protocol_id}")
            return False
        return await proto.restart()

    async def get_all_cores_info(self) -> list[dict]:
        """Get info for all VPN cores (used by dashboard and cores endpoints)."""
        statuses = await get_all_core_statuses()
        cores = []

        for proto_id, meta in PROTOCOL_META.items():
            status_data = statuses.get(proto_id, {})
            is_running = status_data.get("status") == "running"

            # Verify actually running for managed protocols
            proto = self.get_protocol(proto_id)
            if proto and is_running:
                actual = await proto.is_running()
                if not actual:
                    is_running = False
                    await set_core_status(proto_id, {
                        "status": "stopped",
                        "pid": None,
                        "started_at": None,
                        "version": status_data.get("version", ""),
                    })

            # Get port from config
            config = await get_core_config(proto_id)
            port = meta["default_port"]
            if config:
                if proto_id == "v2ray":
                    try:
                        import json
                        cfg = json.loads(config.get("config_json", "{}"))
                        inbounds = cfg.get("inbounds", [])
                        if inbounds:
                            port = inbounds[0].get("port", port)
                    except Exception:
                        pass
                elif proto_id == "wireguard":
                    ifaces = config.get("interfaces", [])
                    if ifaces:
                        port = ifaces[0].get("listen_port", port)
                elif proto_id == "dnstt":
                    port = config.get("listen_port", port)
                else:
                    port = config.get("port", port)

            # Connections
            connections = 0
            if proto and is_running:
                try:
                    connections = await proto.get_active_connections()
                except Exception:
                    pass

            # Calculate uptime
            started_at = status_data.get("started_at")
            uptime = 0
            if is_running and started_at:
                uptime = int(time.time() - float(started_at))

            # Traffic (from cache or estimate)
            traffic = self._traffic_cache.get(proto_id, {"in": 0, "out": 0})

            cores.append({
                "id": proto_id,
                "name": meta["name"],
                "status": "running" if is_running else "stopped",
                "version": status_data.get("version", ""),
                "uptime": uptime,
                "port": port,
                "active_connections": connections,
                "total_traffic": traffic,
            })

        return cores

    async def add_client_to_protocols(self, username: str, client_data: dict, protocols: dict):
        """Add a client to all enabled protocols."""
        for proto_id, enabled in protocols.items():
            if not enabled:
                continue
            proto = self.get_protocol(proto_id)
            if proto:
                try:
                    await proto.add_client(username, client_data)
                except Exception as e:
                    logger.warning(f"Failed to add {username} to {proto_id}: {e}")

    async def remove_client_from_protocols(self, username: str):
        """Remove a client from all protocols."""
        for proto_id, proto in self._protocols.items():
            try:
                await proto.remove_client(username)
            except Exception as e:
                logger.warning(f"Failed to remove {username} from {proto_id}: {e}")

    async def get_client_configs(self, username: str, server_ip: str, protocols: dict) -> dict:
        """Get all protocol configs for a client."""
        configs = {}
        for proto_id, enabled in protocols.items():
            if not enabled:
                continue
            proto = self.get_protocol(proto_id)
            if proto:
                try:
                    cfg = await proto.get_client_config(username, server_ip)
                    if cfg:
                        configs[proto_id] = cfg
                except Exception as e:
                    logger.warning(f"Failed to get config for {username}/{proto_id}: {e}")
        return configs

    async def update_traffic_cache(self):
        """Periodically update traffic statistics from system."""
        try:
            net = psutil.net_io_counters()
            # This is total system traffic - in production you'd use per-interface
            # or per-process tracking. For now we distribute proportionally.
            total_in_gb = net.bytes_recv / (1024 ** 3)
            total_out_gb = net.bytes_sent / (1024 ** 3)

            statuses = await get_all_core_statuses()
            running = [pid for pid, s in statuses.items() if s.get("status") == "running"]
            if running:
                share_in = total_in_gb / len(running)
                share_out = total_out_gb / len(running)
                for proto_id in PROTOCOL_META:
                    if proto_id in [p for p in running]:
                        self._traffic_cache[proto_id] = {
                            "in": round(share_in, 1),
                            "out": round(share_out, 1),
                        }
                    else:
                        prev = self._traffic_cache.get(proto_id, {"in": 0, "out": 0})
                        self._traffic_cache[proto_id] = prev
        except Exception as e:
            logger.warning(f"Traffic cache update error: {e}")


# Singleton
protocol_manager = ProtocolManager()
