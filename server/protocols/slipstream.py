"""
CandyConnect - SlipStream Protocol (Coming Soon)
"""
import asyncio
from protocols.base import BaseProtocol
from database import add_log

class SlipStreamProtocol(BaseProtocol):
    PROTOCOL_ID = "slipstream"
    PROTOCOL_NAME = "SlipStream"
    DEFAULT_PORT = 8388

    async def install(self) -> bool:
        await add_log("INFO", self.PROTOCOL_NAME, "SlipStream is planned for future release.")
        return False

    async def start(self) -> bool:
        await add_log("WARN", self.PROTOCOL_NAME, "SlipStream is not yet implemented.")
        return False

    async def stop(self) -> bool:
        return True

    async def is_running(self) -> bool:
        return False

    async def add_client(self, username: str, client_data: dict) -> dict:
        return {}

    async def remove_client(self, username: str, protocol_data: dict):
        pass
