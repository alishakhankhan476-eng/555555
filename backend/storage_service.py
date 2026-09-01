"""Emergent Managed Object Storage. Private files; only the backend holds the key.
Async httpx wrappers around the init -> storage_key -> object handshake."""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ["EMERGENT_LLM_KEY"]
APP_NAME = "chatly-ai-messenger"

_storage_key: str | None = None


async def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    async with httpx.AsyncClient(timeout=30) as c:
        resp = await c.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY})
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
    return _storage_key


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = await init_storage()
    async with httpx.AsyncClient(timeout=120) as c:
        resp = await c.put(f"{STORAGE_URL}/objects/{path}",
                           headers={"X-Storage-Key": key, "Content-Type": content_type}, content=data)
        if resp.status_code == 503:  # stale key -> reinit once
            key = await init_storage(force=True)
            resp = await c.put(f"{STORAGE_URL}/objects/{path}",
                               headers={"X-Storage-Key": key, "Content-Type": content_type}, content=data)
        if resp.status_code == 402:
            raise RuntimeError("storage_quota_exceeded")
        resp.raise_for_status()
        return resp.json()


async def get_object(path: str) -> tuple[bytes, str]:
    global _storage_key
    key = await init_storage()
    async with httpx.AsyncClient(timeout=60) as c:
        resp = await c.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key})
        if resp.status_code == 503:
            key = await init_storage(force=True)
            resp = await c.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key})
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def build_path(user_id: str, ext: str, uid: str) -> str:
    ext = (ext or "bin").lstrip(".").lower()
    return f"{APP_NAME}/uploads/{user_id}/{uid}.{ext}"
