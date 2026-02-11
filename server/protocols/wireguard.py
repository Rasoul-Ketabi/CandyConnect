"""
CandyConnect - WireGuard Protocol Manager
"""
import asyncio, os, json, base64, time
from protocols.base import BaseProtocol
from database import get_core_config, get_core_status, set_core_status, add_log
from config import DATA_DIR


class WireGuardProtocol(BaseProtocol):
    PROTOCOL_ID = "wireguard"
    PROTOCOL_NAME = "WireGuard"
    DEFAULT_PORT = 51820

    WG_DIR = "/etc/wireguard"

    async def install(self) -> bool:
        try:
            await add_log("INFO", self.PROTOCOL_NAME, "Installing WireGuard...")
            rc, _, err = await self._run_cmd(
                "sudo apt update && sudo apt install wireguard wireguard-tools -y",
                check=False,
            )
            if rc != 0:
                await add_log("ERROR", self.PROTOCOL_NAME, f"Installation failed: {err}")
                return False

            # Enable IP forwarding
            await self._run_cmd("sudo sysctl -w net.ipv4.ip_forward=1", check=False)
            await self._run_cmd(
                "echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf",
                check=False,
            )

            await add_log("INFO", self.PROTOCOL_NAME, "WireGuard installed successfully")
            return True
        except Exception as e:
            await add_log("ERROR", self.PROTOCOL_NAME, f"Installation error: {e}")
            return False

    async def start(self) -> bool:
        try:
            config = await get_core_config("wireguard")
            if not config or not config.get("interfaces"):
                await add_log("ERROR", self.PROTOCOL_NAME, "No interfaces configured")
                return False

            for iface in config["interfaces"]:
                name = iface["name"]
                await self._write_config(iface)
                await self._run_cmd(f"sudo systemctl enable wg-quick@{name}", check=False)
                rc, _, err = await self._run_cmd(f"sudo systemctl start wg-quick@{name}", check=False)
                if rc != 0:
                    # Try bringing up directly
                    await self._run_cmd(f"sudo wg-quick up {name}", check=False)

            version = await self.get_version()
            await set_core_status(self.PROTOCOL_ID, {
                "status": "running",
                "pid": None,
                "started_at": int(time.time()),
                "version": version,
            })
            await add_log("INFO", self.PROTOCOL_NAME, "WireGuard started")
            return True
        except Exception as e:
            await add_log("ERROR", self.PROTOCOL_NAME, f"Failed to start: {e}")
            return False

    async def stop(self) -> bool:
        try:
            config = await get_core_config("wireguard")
            if config and config.get("interfaces"):
                for iface in config["interfaces"]:
                    name = iface["name"]
                    await self._run_cmd(f"sudo systemctl stop wg-quick@{name}", check=False)
                    await self._run_cmd(f"sudo wg-quick down {name}", check=False)

            status = await get_core_status(self.PROTOCOL_ID)
            await set_core_status(self.PROTOCOL_ID, {
                "status": "stopped",
                "pid": None,
                "started_at": None,
                "version": status.get("version", ""),
            })
            await add_log("INFO", self.PROTOCOL_NAME, "WireGuard stopped")
            return True
        except Exception as e:
            await add_log("ERROR", self.PROTOCOL_NAME, f"Failed to stop: {e}")
            return False

    async def is_running(self) -> bool:
        config = await get_core_config("wireguard")
        if not config or not config.get("interfaces"):
            return False
        for iface in config["interfaces"]:
            active = await self._is_service_active(f"wg-quick@{iface['name']}")
            if active:
                return True
        return False

    async def get_version(self) -> str:
        rc, out, _ = await self._run_cmd("wg --version", check=False)
        if rc == 0 and out:
            # "wireguard-tools v1.0.20210914 - ..."
            parts = out.split()
            for p in parts:
                if p.startswith("v"):
                    return p.lstrip("v")
            return out.split()[0] if out else ""
        return ""

    async def get_active_connections(self) -> int:
        rc, out, _ = await self._run_cmd("sudo wg show all peers", check=False)
        if rc == 0 and out:
            return len(out.strip().split("\n"))
        return 0

    async def add_client(self, username: str, client_data: dict) -> dict:
        """Generate WireGuard keys for a client and add peer to config."""
        # Generate client keys
        rc, privkey, _ = await self._run_cmd("wg genkey")
        if rc != 0:
            raise RuntimeError("Failed to generate WireGuard private key")

        proc = await asyncio.create_subprocess_shell(
            "wg pubkey",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        pubkey_out, _ = await proc.communicate(privkey.encode())
        pubkey = pubkey_out.decode().strip()

        # Get server config
        config = await get_core_config("wireguard")
        if not config or not config.get("interfaces"):
            raise RuntimeError("No WireGuard interfaces configured")

        iface = config["interfaces"][0]
        # Assign IP
        base_ip = iface["address"].split("/")[0].rsplit(".", 1)[0]
        # Find next available IP (simple approach)
        next_ip = f"{base_ip}.{hash(username) % 200 + 2}"

        # Add peer to interface
        await self._run_cmd(
            f"sudo wg set {iface['name']} peer {pubkey} allowed-ips {next_ip}/32",
            check=False,
        )

        return {
            "private_key": privkey,
            "public_key": pubkey,
            "address": f"{next_ip}/32",
            "dns": iface.get("dns", "1.1.1.1"),
            "endpoint_port": iface.get("listen_port", 51820),
            "server_public_key": iface.get("public_key", ""),
        }

    async def remove_client(self, username: str):
        # Would need to track pubkey -> username mapping
        pass

    async def get_client_config(self, username: str, server_ip: str) -> dict:
        config = await get_core_config("wireguard")
        if not config or not config.get("interfaces"):
            return {}
        iface = config["interfaces"][0]
        return {
            "type": "wireguard",
            "server": server_ip,
            "port": iface.get("listen_port", 51820),
            "server_public_key": iface.get("public_key", ""),
            "dns": iface.get("dns", "1.1.1.1"),
            "mtu": iface.get("mtu", 1420),
        }

    async def _write_config(self, iface: dict):
        """Write WireGuard config file."""
        os.makedirs(self.WG_DIR, exist_ok=True)
        name = iface["name"]

        # Generate keys if not set
        if not iface.get("private_key"):
            rc, privkey, _ = await self._run_cmd("wg genkey")
            if rc == 0:
                iface["private_key"] = privkey
                proc = await asyncio.create_subprocess_shell(
                    "wg pubkey",
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                )
                pubkey_out, _ = await proc.communicate(privkey.encode())
                iface["public_key"] = pubkey_out.decode().strip()
                # Update config in DB
                from database import update_core_config
                config = await get_core_config("wireguard")
                for i, existing in enumerate(config.get("interfaces", [])):
                    if existing["id"] == iface["id"]:
                        config["interfaces"][i] = iface
                        break
                await update_core_config("wireguard", config)

        conf = f"""[Interface]
Address = {iface['address']}
ListenPort = {iface['listen_port']}
PrivateKey = {iface['private_key']}
MTU = {iface.get('mtu', 1420)}
DNS = {iface.get('dns', '1.1.1.1')}
PostUp = {iface.get('post_up', '')}
PostDown = {iface.get('post_down', '')}
"""
        conf_path = os.path.join(self.WG_DIR, f"{name}.conf")
        await self._run_cmd(f"echo '{conf}' | sudo tee {conf_path}")
        await self._run_cmd(f"sudo chmod 600 {conf_path}")
