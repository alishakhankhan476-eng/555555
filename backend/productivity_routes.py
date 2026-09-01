import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from db import db
from security import get_current_user

router = APIRouter(prefix="/api", tags=["productivity"])


def _now():
    return datetime.now(timezone.utc).isoformat()


# ---------------- Tasks ----------------
class TaskBody(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    due: str | None = None
    priority: str = "normal"  # low/normal/high
    person: str | None = None
    source_chat_id: str | None = None
    source_message_id: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    due: str | None = None
    priority: str | None = None
    status: str | None = None  # pending/done


@router.post("/tasks")
async def create_task(body: TaskBody, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["user_id"], "title": body.title.strip(),
           "due": body.due, "priority": body.priority, "person": body.person,
           "status": "pending", "source_chat_id": body.source_chat_id,
           "source_message_id": body.source_message_id, "created_at": _now(), "deleted_at": None}
    await db.tasks.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.get("/tasks")
async def list_tasks(user: dict = Depends(get_current_user)):
    cursor = db.tasks.find({"user_id": user["user_id"], "deleted_at": None}, {"_id": 0}).sort("created_at", -1)
    return {"tasks": [t async for t in cursor]}


@router.put("/tasks/{tid}")
async def update_task(tid: str, body: TaskUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    res = await db.tasks.update_one({"id": tid, "user_id": user["user_id"], "deleted_at": None}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found.")
    t = await db.tasks.find_one({"id": tid}, {"_id": 0})
    return t


@router.delete("/tasks/{tid}")
async def delete_task(tid: str, user: dict = Depends(get_current_user)):
    await db.tasks.update_one({"id": tid, "user_id": user["user_id"]}, {"$set": {"deleted_at": _now()}})
    return {"status": "deleted"}


# ---------------- Reminders ----------------
class ReminderBody(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    remind_at: str | None = None
    source_message_id: str | None = None


@router.post("/reminders")
async def create_reminder(body: ReminderBody, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["user_id"], "title": body.title.strip(),
           "remind_at": body.remind_at, "source_message_id": body.source_message_id,
           "done": False, "created_at": _now()}
    await db.reminders.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.get("/reminders")
async def list_reminders(user: dict = Depends(get_current_user)):
    cursor = db.reminders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    return {"reminders": [r async for r in cursor]}


@router.put("/reminders/{rid}/done")
async def complete_reminder(rid: str, user: dict = Depends(get_current_user)):
    await db.reminders.update_one({"id": rid, "user_id": user["user_id"]}, {"$set": {"done": True}})
    return {"status": "done"}


@router.delete("/reminders/{rid}")
async def delete_reminder(rid: str, user: dict = Depends(get_current_user)):
    await db.reminders.delete_one({"id": rid, "user_id": user["user_id"]})
    return {"status": "deleted"}


# ---------------- Important messages ----------------
class ImportantBody(BaseModel):
    message_id: str
    chat_id: str
    text: str
    sender_name: str | None = None
    level: str = "important"  # urgent/important


@router.post("/important")
async def mark_important(body: ImportantBody, user: dict = Depends(get_current_user)):
    existing = await db.important_messages.find_one({"user_id": user["user_id"], "message_id": body.message_id})
    if existing:
        await db.important_messages.delete_one({"user_id": user["user_id"], "message_id": body.message_id})
        return {"important": False}
    await db.important_messages.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["user_id"], "message_id": body.message_id,
        "chat_id": body.chat_id, "text": body.text, "sender_name": body.sender_name,
        "level": body.level, "created_at": _now(),
    })
    return {"important": True}


@router.get("/important")
async def list_important(user: dict = Depends(get_current_user)):
    cursor = db.important_messages.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    return {"important": [m async for m in cursor]}
