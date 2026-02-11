"""
CandyConnect Server - System Information Collector
"""
import platform, socket, asyncio
import psutil


async def get_server_info() -> dict:
    """Collect real server information using psutil."""
    # CPU
    cpu_model = "Unknown"
    try:
        with open("/proc/cpuinfo", "r") as f:
            for line in f:
                if line.startswith("model name"):
                    cpu_model = line.split(":")[1].strip()
                    break
    except Exception:
        cpu_model = platform.processor() or "Unknown"

    cpu_count = psutil.cpu_count(logical=True) or 1
    cpu_usage = psutil.cpu_percent(interval=0.5)

    # Memory
    mem = psutil.virtual_memory()
    ram_total = mem.total // (1024 * 1024)  # MB
    ram_used = mem.used // (1024 * 1024)

    # Disk
    disk = psutil.disk_usage("/")
    disk_total = disk.total // (1024 ** 3)  # GB
    disk_used = disk.used // (1024 ** 3)

    # Network
    net = psutil.net_io_counters()
    total_in = net.bytes_recv / (1024 ** 3)   # GB
    total_out = net.bytes_sent / (1024 ** 3)

    # Speed estimation (delta over small interval)
    net1 = psutil.net_io_counters()
    await asyncio.sleep(0.5)
    net2 = psutil.net_io_counters()
    speed_in = ((net2.bytes_recv - net1.bytes_recv) * 2 * 8) / (1024 * 1024)  # Mbps
    speed_out = ((net2.bytes_sent - net1.bytes_sent) * 2 * 8) / (1024 * 1024)

    # Hostname & IP
    hostname = socket.gethostname()
    try:
        proc = await asyncio.create_subprocess_shell(
            "curl -4 -s --connect-timeout 3 ifconfig.me",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        ip = stdout.decode().strip()
        if not ip:
            raise ValueError()
    except Exception:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
        except Exception:
            ip = "127.0.0.1"

    # OS / Kernel
    os_name = "Unknown"
    try:
        with open("/etc/os-release", "r") as f:
            for line in f:
                if line.startswith("PRETTY_NAME="):
                    os_name = line.split("=", 1)[1].strip().strip('"')
                    break
    except Exception:
        os_name = f"{platform.system()} {platform.release()}"

    kernel = platform.release()

    # Uptime
    uptime = int(psutil.boot_time())
    import time
    uptime_secs = int(time.time() - uptime)

    return {
        "hostname": hostname,
        "ip": ip,
        "os": os_name,
        "kernel": kernel,
        "uptime": uptime_secs,
        "cpu": {
            "model": cpu_model,
            "cores": cpu_count,
            "usage": round(cpu_usage, 1),
        },
        "ram": {
            "total": ram_total,
            "used": ram_used,
        },
        "disk": {
            "total": disk_total,
            "used": disk_used,
        },
        "network": {
            "total_in": round(total_in, 1),
            "total_out": round(total_out, 1),
            "speed_in": round(speed_in, 1),
            "speed_out": round(speed_out, 1),
        },
    }
