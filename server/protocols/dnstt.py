"""
CandyConnect - DNSTT Protocol Manager
Based on https://github.com/bugfloyd/dnstt-deploy
DNSTT tunnels traffic over DNS queries using SSH for each user.
"""
import asyncio, os, time, secrets, string
from protocols.base import BaseProtocol
from database import get_core_config, get_core_status, set_core_status, add_log
from config import DATA_DIR


class DNSTTProtocol(BaseProtocol):
    PROTOCOL_ID = "dnstt"
    PROTOCOL_NAME = "DNSTT"
    DEFAULT_PORT = 53

    DNSTT_DIR = os.path.join(DATA_DIR, "cores", "dnstt")

    async def install(self) -> bool:
        try:
            await add_log("INFO", self.PROTOCOL_NAME, "Configuring DNSTT...")
            os.makedirs(self.DNSTT_DIR, exist_ok=True)

            # Check if binary exists (should be in /usr/local/bin from Docker)
            dnstt_bin = "/usr/local/bin/dnstt-server"
            if not os.path.exists(dnstt_bin):
                await add_log("ERROR", self.PROTOCOL_NAME, "dnstt-server binary not found in /usr/local/bin")
                return False

            # Create dnstt user if not exists
            await self._run_cmd("id dnstt &>/dev/null || useradd -r -s /bin/false -d /nonexistent dnstt", check=False)

            # Generate keypair if missing
            priv_key = os.path.join(self.DNSTT_DIR, "server.key")
            pub_key = os.path.join(self.DNSTT_DIR, "server.pub")
            
            if not os.path.exists(priv_key):
                await self._run_cmd(
                    f"{dnstt_bin} -gen-key -privkey-file {priv_key} -pubkey-file {pub_key}",
                    check=False,
                )
                await self._run_cmd(f"chown dnstt:dnstt {priv_key} {pub_key}", check=False)
                await self._run_cmd(f"chmod 600 {priv_key}", check=False)

            # Update public key in DB
            if os.path.exists(pub_key):
                with open(pub_key, "r") as f:
                    key_content = f.read().strip()
                    from database import update_core_config
                    config = await get_core_config("dnstt") or {}
                    config["public_key"] = key_content
                    await update_core_config("dnstt", config)

            await add_log("INFO", self.PROTOCOL_NAME, "DNSTT configured successfully")
            return True
        except Exception as e:
            await add_log("ERROR", self.PROTOCOL_NAME, f"Configuration error: {e}")
            return False

    async def start(self) -> bool:
        try:
            config = await get_core_config("dnstt")
            if not config:
                await add_log("ERROR", self.PROTOCOL_NAME, "No DNSTT config found")
                return False

            dnstt_bin = "/usr/local/bin/dnstt-server"
            if not os.path.exists(dnstt_bin):
                await add_log("ERROR", self.PROTOCOL_NAME, "dnstt-server binary missing")
                return False

            domain = config.get("domain", "dns.candyconnect.io")
            listen_port = config.get("listen_port", 5300)
            mtu = config.get("mtu", 1232)
            tunnel_mode = config.get("tunnel_mode", "ssh")
            priv_key = os.path.join(self.DNSTT_DIR, "server.key")

            # Determine target port (SSH=22, SOCKS=1080)
            target_port = 22
            if tunnel_mode == "socks":
                target_port = 1080
                # Ensure danted is running
                await self._run_cmd("sudo systemctl start danted", check=False)
            else:
                # Ensure ssh is running
                await self._run_cmd("sudo systemctl start ssh", check=False)

            # Redirect port 53 to listen_port
            await self._setup_redirection(listen_port)

            # Start dnstt-server
            pid = await self._start_process(
                f"{dnstt_bin} -udp :{listen_port} -privkey-file {priv_key} -mtu {mtu} {domain} 127.0.0.1:{target_port}",
                cwd=self.DNSTT_DIR,
            )
            
            if not pid:
                await add_log("ERROR", self.PROTOCOL_NAME, "Failed to start DNSTT process")
                return False
            return True
        except Exception as e:
            await add_log("ERROR", self.PROTOCOL_NAME, f"Failed to start: {e}")
            return False

    async def _setup_redirection(self, port: int):
        """Redirect port 53/udp to the custom listen port using iptables."""
        # Get default interface
        _, iface, _ = await self._run_cmd("ip route | grep default | awk '{print $5}' | head -1", check=False)
        iface = iface.strip() or "eth0"
        
        # Add rules
        await self._run_cmd(f"sudo iptables -I INPUT -p udp --dport {port} -j ACCEPT", check=False)
        await self._run_cmd(
            f"sudo iptables -t nat -I PREROUTING -i {iface} -p udp --dport 53 -j REDIRECT --to-ports {port}",
            check=False,
        )
        # IPv6 support if available
        await self._run_cmd(f"sudo ip6tables -I INPUT -p udp --dport {port} -j ACCEPT", check=False)
        await self._run_cmd(
            f"sudo ip6tables -t nat -I PREROUTING -i {iface} -p udp --dport 53 -j REDIRECT --to-ports {port}",
            check=False,
        )

    async def get_version(self) -> str:
        dnstt_bin = os.path.join(self.DNSTT_DIR, "dnstt-server")
        if os.path.exists(dnstt_bin):
            rc, out, _ = await self._run_cmd(f"stat -c '%Y' {dnstt_bin}", check=False)
            if rc == 0 and out:
                ts = int(out.strip())
                return time.strftime("0.%Y%m%d", time.localtime(ts))
        return ""

    async def get_active_connections(self) -> int:
        # Count SSH connections from DNSTT users
        rc, out, _ = await self._run_cmd(
            "ps aux | grep 'sshd:.*dnstt_' | grep -v grep | wc -l",
            check=False,
        )
        try:
            return int(out.strip())
        except ValueError:
            return 0

    async def add_client(self, username: str, client_data: dict) -> dict:
        """Create a non-root SSH user for DNSTT access."""
        ssh_user = f"dnstt_{username}"
        password = client_data.get("password", self._gen_password())

        # Create system user (non-root, no shell login except through tunnel)
        await self._run_cmd(
            f"sudo useradd -m -s /bin/false {ssh_user} 2>/dev/null || true",
            check=False,
        )
        # Set password
        proc = await asyncio.create_subprocess_shell(
            f"echo '{ssh_user}:{password}' | sudo chpasswd",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()

        return {"ssh_username": ssh_user, "ssh_password": password}

    async def remove_client(self, username: str, protocol_data: dict):
        ssh_user = protocol_data.get("ssh_username") or f"dnstt_{username}"
        await self._run_cmd(f"sudo userdel -r {ssh_user} 2>/dev/null || true", check=False)

    async def get_client_config(self, username: str, server_ip: str, protocol_data: dict) -> dict:
        config = await get_core_config("dnstt")
        if not config:
            return {}
        return {
            "type": "dnstt",
            "server": server_ip,
            "domain": config.get("domain", ""),
            "port": config.get("listen_port", 5300),
            "tunnel_mode": config.get("tunnel_mode", "ssh"),
            "mtu": config.get("mtu", 1232),
            "public_key": config.get("public_key", ""),
            "ssh_username": protocol_data.get("ssh_username") or f"dnstt_{username}",
            "ssh_password": protocol_data.get("ssh_password"),
        }

    def _gen_password(self, length: int = 16) -> str:
        chars = string.ascii_letters + string.digits + "!@#$%"
        return "".join(secrets.choice(chars) for _ in range(length))
