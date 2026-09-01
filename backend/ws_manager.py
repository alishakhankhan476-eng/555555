import asyncio
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, set[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        async with self.lock:
            self.active.setdefault(user_id, set()).add(ws)

    async def disconnect(self, user_id: str, ws: WebSocket):
        async with self.lock:
            conns = self.active.get(user_id)
            if conns and ws in conns:
                conns.discard(ws)
                if not conns:
                    self.active.pop(user_id, None)

    async def send_to_user(self, user_id: str, payload: dict):
        conns = list(self.active.get(user_id, set()))
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                pass

    async def send_to_users(self, user_ids: list[str], payload: dict):
        for uid in set(user_ids):
            await self.send_to_user(uid, payload)

    def is_online(self, user_id: str) -> bool:
        return bool(self.active.get(user_id))


manager = ConnectionManager()
