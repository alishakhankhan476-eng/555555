import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from db import db
from security import get_current_user
from ws_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/groups", tags=["groups"])


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _members(chat: dict, viewer: str) -> list:
    out = []
    for pid in chat["participants"]:
        u = await db.users.find_one({"user_id": pid}, {"_id": 0})
        if not u:
            continue
        role = "owner" if pid == chat.get("owner_id") else ("admin" if pid in chat.get("admins", []) else "member")
        out.append({"user_id": pid, "name": u["name"], "avatar": u.get("avatar"),
                    "username": u.get("username"), "role": role,
                    "online": manager.is_online(pid) or u.get("is_bot", False)})
    return out


class CreateGroupBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = ""
    member_ids: list[str] = []
    avatar: str | None = None


@router.post("")
async def create_group(body: CreateGroupBody, user: dict = Depends(get_current_user)):
    participants = sorted(set([user["user_id"]] + body.member_ids))
    chat_id = "group_" + uuid.uuid4().hex[:16]
    doc = {
        "chat_id": chat_id, "type": "group", "name": body.name.strip(),
        "description": body.description.strip(), "avatar": body.avatar,
        "owner_id": user["user_id"], "admins": [user["user_id"]],
        "participants": participants, "ai_enabled": True, "created_at": _now(),
        "last_message": None, "last_ts": _now(), "muted_by": [], "pinned_by": [],
        "archived_by": [], "pinned_message": None, "announcements": [],
    }
    await db.chats.insert_one(dict(doc))
    await db.messages.insert_one({
        "message_id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": "system",
        "text": f"{user['name']} created the group \"{body.name.strip()}\"", "type": "system",
        "status": "sent", "reactions": {}, "starred_by": [], "read_by": [], "edited": False,
        "deleted": False, "created_at": _now(),
    })
    for pid in participants:
        await manager.send_to_user(pid, {"type": "group_created", "chat_id": chat_id})
    return {"chat_id": chat_id}


@router.get("/{chat_id}")
async def group_detail(chat_id: str, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"chat_id": chat_id, "participants": user["user_id"], "type": "group"}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Group not found.")
    return {
        "chat_id": chat_id, "name": chat.get("name"), "description": chat.get("description", ""),
        "avatar": chat.get("avatar"), "owner_id": chat.get("owner_id"), "admins": chat.get("admins", []),
        "members": await _members(chat, user["user_id"]),
        "pinned_message": chat.get("pinned_message"), "announcements": chat.get("announcements", []),
        "my_role": "owner" if user["user_id"] == chat.get("owner_id") else ("admin" if user["user_id"] in chat.get("admins", []) else "member"),
    }


class MembersBody(BaseModel):
    member_ids: list[str]


@router.post("/{chat_id}/members")
async def add_members(chat_id: str, body: MembersBody, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"chat_id": chat_id, "type": "group"})
    if not chat or user["user_id"] not in chat.get("admins", []):
        raise HTTPException(status_code=403, detail="Only admins can add members.")
    await db.chats.update_one({"chat_id": chat_id}, {"$addToSet": {"participants": {"$each": body.member_ids}}})
    for pid in body.member_ids:
        u = await db.users.find_one({"user_id": pid}, {"_id": 0})
        if u:
            await db.messages.insert_one({
                "message_id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": "system",
                "text": f"{u['name']} was added", "type": "system", "status": "sent", "reactions": {},
                "starred_by": [], "read_by": [], "edited": False, "deleted": False, "created_at": _now()})
        await manager.send_to_user(pid, {"type": "group_created", "chat_id": chat_id})
    fresh = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0})
    return {"members": await _members(fresh, user["user_id"])}


@router.delete("/{chat_id}/members/{member_id}")
async def remove_member(chat_id: str, member_id: str, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"chat_id": chat_id, "type": "group"})
    if not chat or user["user_id"] not in chat.get("admins", []):
        raise HTTPException(status_code=403, detail="Only admins can remove members.")
    if member_id == chat.get("owner_id"):
        raise HTTPException(status_code=400, detail="The owner cannot be removed.")
    await db.chats.update_one({"chat_id": chat_id}, {"$pull": {"participants": member_id, "admins": member_id}})
    return {"status": "removed"}


class RoleBody(BaseModel):
    member_id: str
    make_admin: bool


@router.post("/{chat_id}/role")
async def set_role(chat_id: str, body: RoleBody, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"chat_id": chat_id, "type": "group"})
    if not chat or user["user_id"] != chat.get("owner_id"):
        raise HTTPException(status_code=403, detail="Only the owner can manage admins.")
    op = "$addToSet" if body.make_admin else "$pull"
    await db.chats.update_one({"chat_id": chat_id}, {op: {"admins": body.member_id}})
    return {"status": "updated"}


@router.post("/{chat_id}/leave")
async def leave_group(chat_id: str, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"chat_id": chat_id, "type": "group", "participants": user["user_id"]})
    if not chat:
        raise HTTPException(status_code=404, detail="Group not found.")
    await db.chats.update_one({"chat_id": chat_id}, {"$pull": {"participants": user["user_id"], "admins": user["user_id"]}})
    await db.messages.insert_one({
        "message_id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": "system",
        "text": f"{user['name']} left", "type": "system", "status": "sent", "reactions": {},
        "starred_by": [], "read_by": [], "edited": False, "deleted": False, "created_at": _now()})
    return {"status": "left"}
