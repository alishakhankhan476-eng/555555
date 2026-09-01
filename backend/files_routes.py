import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import Response
from pydantic import BaseModel

from db import db
from security import get_current_user, get_user_id_from_token
from ws_manager import manager
from storage_service import put_object, get_object, build_path
from media_service import transcribe_audio, image_qa, extract_document_text
from ai_service import ai_complete, ai_json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["files"])

MAX_FILE = 25 * 1024 * 1024
IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"}
DOC_EXT = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".csv", ".txt", ".md", ".json", ".zip"}
CHATLY_SYS = "You are Chatly. Never invent extracted information. If confidence is low, say so. Cite the source file."


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _require_member(chat_id: str, user_id: str) -> dict:
    chat = await db.chats.find_one({"chat_id": chat_id, "participants": user_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found.")
    return chat


async def _persist_attachment_message(chat: dict, sender_id: str, text: str, mtype: str, attachment: dict) -> dict:
    msg = {
        "message_id": str(uuid.uuid4()), "chat_id": chat["chat_id"], "sender_id": sender_id,
        "text": text, "type": mtype, "status": "sent", "reply_to": None, "reactions": {},
        "starred_by": [], "read_by": [sender_id], "edited": False, "deleted": False,
        "attachment": attachment, "created_at": _now(),
    }
    await db.messages.insert_one(dict(msg))
    label = {"image": "📷 Photo", "file": "📎 " + attachment.get("filename", "File"), "voice": "🎤 Voice message"}.get(mtype, text)
    await db.chats.update_one({"chat_id": chat["chat_id"]}, {"$set": {"last_message": text or label, "last_ts": msg["created_at"]}})
    msg.pop("_id", None)
    others = [p for p in chat["participants"] if p != sender_id]
    await manager.send_to_users(others, {"type": "message", "chat_id": chat["chat_id"], "message": msg})
    return msg


@router.post("/chats/{chat_id}/attachments")
async def upload_attachment(chat_id: str, file: UploadFile = File(...), caption: str = Form(""),
                            user: dict = Depends(get_current_user)):
    chat = await _require_member(chat_id, user["user_id"])
    data = await file.read()
    if not data or len(data) > MAX_FILE:
        raise HTTPException(status_code=413, detail="File must be non-empty and under 25 MB.")
    fname = file.filename or "file"
    ext = ("." + fname.rsplit(".", 1)[-1].lower()) if "." in fname else ""
    is_image = (file.content_type in IMAGE_MIMES) or ext in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"}
    if not is_image and ext not in DOC_EXT:
        raise HTTPException(status_code=415, detail="Unsupported file type.")
    uid = str(uuid.uuid4())
    path = build_path(user["user_id"], ext or "bin", uid)
    try:
        await put_object(path, data, file.content_type or "application/octet-stream")
    except RuntimeError:
        raise HTTPException(status_code=402, detail="Storage limit reached.")
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=502, detail="Upload failed. Please retry.")
    extracted = "" if is_image else extract_document_text(data, fname, file.content_type or "")
    attachment = {
        "storage_path": path, "filename": fname, "mime": file.content_type or "application/octet-stream",
        "size": len(data), "kind": "image" if is_image else "file",
        "extracted_text": extracted[:20000], "has_text": bool(extracted),
    }
    mtype = "image" if is_image else "file"
    msg = await _persist_attachment_message(chat, user["user_id"], caption.strip(), mtype, attachment)
    return {"message": msg}


@router.post("/chats/{chat_id}/voice")
async def upload_voice(chat_id: str, file: UploadFile = File(...), duration: float = Form(0),
                       language: str = Form("en"), user: dict = Depends(get_current_user)):
    chat = await _require_member(chat_id, user["user_id"])
    data = await file.read()
    if not data or len(data) > MAX_FILE:
        raise HTTPException(status_code=413, detail="Voice message too large.")
    fname = file.filename or "voice.m4a"
    ext = ("." + fname.rsplit(".", 1)[-1].lower()) if "." in fname else ".m4a"
    uid = str(uuid.uuid4())
    path = build_path(user["user_id"], ext, uid)
    try:
        await put_object(path, data, file.content_type or "audio/m4a")
    except Exception as e:
        logger.error(f"Voice upload failed: {e}")
        raise HTTPException(status_code=502, detail="Upload failed. Please retry.")
    transcript = ""
    try:
        transcript = await transcribe_audio(data, fname, language)
    except Exception as e:
        logger.warning(f"Transcription failed: {e}")
    attachment = {
        "storage_path": path, "filename": fname, "mime": file.content_type or "audio/m4a",
        "size": len(data), "kind": "voice", "duration": duration, "transcript": transcript,
    }
    msg = await _persist_attachment_message(chat, user["user_id"], "", "voice", attachment)
    return {"message": msg}


@router.get("/files/{path:path}")
async def download_file(path: str, token: str = Query(None), user_id_q: str = Query(None)):
    # Accept token via query (needed for <img> on web). Verify membership via DB.
    uid = await get_user_id_from_token(token) if token else None
    if not uid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    msg = await db.messages.find_one({"attachment.storage_path": path}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="File not found.")
    chat = await db.chats.find_one({"chat_id": msg["chat_id"], "participants": uid})
    if not chat:
        raise HTTPException(status_code=403, detail="Not authorized to access this file.")
    try:
        content, ctype = await get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="File unavailable.")
    return Response(content=content, media_type=ctype)


# ---------------- Attachment intelligence ----------------
class AttachmentAIBody(BaseModel):
    message_id: str
    action: str  # summarize/explain/translate/ask/extract/find_amount/find_dates/find_names/create_task/create_notes
    question: str | None = None


@router.post("/ai/attachment")
async def attachment_ai(body: AttachmentAIBody, user: dict = Depends(get_current_user)):
    msg = await db.messages.find_one({"message_id": body.message_id}, {"_id": 0})
    if not msg or not msg.get("attachment"):
        raise HTTPException(status_code=404, detail="Attachment not found.")
    chat = await db.chats.find_one({"chat_id": msg["chat_id"], "participants": user["user_id"]})
    if not chat:
        raise HTTPException(status_code=403, detail="Not authorized.")
    priv = await db.privacy.find_one({"user_id": user["user_id"]}, {"_id": 0})
    att = msg["attachment"]
    kind = att["kind"]
    fname = att.get("filename", "file")

    prompts = {
        "summarize": "Summarize the content clearly in a few bullet points.",
        "explain": "Explain what this content is about in simple terms.",
        "translate": "Translate the content to English.",
        "extract": "Extract key information: names, dates, amounts, tasks and deadlines. Return as a clear list.",
        "find_amount": "Find and list all monetary amounts. State the total if present.",
        "find_dates": "Find and list all dates and deadlines.",
        "find_names": "Find and list all people/organization names.",
        "create_notes": "Create concise, well-structured notes from the content.",
        "ask": body.question or "What is this about?",
    }
    instruction = prompts.get(body.action, "Summarize the content.")

    if kind == "image":
        if priv and not priv.get("images", True):
            raise HTTPException(status_code=403, detail="Image analysis is disabled in your privacy settings.")
        try:
            content, ctype = await get_object(att["storage_path"])
            answer = await image_qa(content, att.get("mime", "image/jpeg"), instruction)
        except Exception as e:
            logger.error(f"Image AI failed: {e}")
            raise HTTPException(status_code=502, detail="Could not analyze the image.")
    else:
        if priv and not priv.get("documents", True):
            raise HTTPException(status_code=403, detail="Document analysis is disabled in your privacy settings.")
        text = att.get("extracted_text") or att.get("transcript") or ""
        if not text.strip():
            return {"result": "I couldn't read any text from this file.", "source": fname}
        answer = await ai_complete(CHATLY_SYS, f"{instruction}\n\nFile: {fname}\n\nContent:\n{text}",
                                   temperature=0.3, max_tokens=1200)

    if body.action == "create_task":
        data = await ai_json("Extract the single most important task.",
                             f"Content:\n{att.get('extracted_text') or att.get('transcript') or fname}\n\nReturn JSON: {{\"title\": \"...\"}}")
        title = (data.get("title") if isinstance(data, dict) else None) or fname
        await db.tasks.insert_one({"id": str(uuid.uuid4()), "user_id": user["user_id"], "title": title[:200],
                                   "due": None, "priority": "high", "person": None, "status": "pending",
                                   "source_chat_id": msg["chat_id"], "source_message_id": body.message_id,
                                   "created_at": _now(), "deleted_at": None})
        return {"result": f"Task created: {title}", "source": fname}

    return {"result": answer.strip(), "source": fname}


class AttachSearchBody(BaseModel):
    query: str


@router.post("/ai/attachment-search")
async def attachment_search(body: AttachSearchBody, user: dict = Depends(get_current_user)):
    chats = db.chats.find({"participants": user["user_id"]}, {"_id": 0})
    chat_ids = [c["chat_id"] async for c in chats]
    terms = [t for t in body.query.lower().split() if len(t) > 2]
    cursor = db.messages.find(
        {"chat_id": {"$in": chat_ids}, "attachment": {"$exists": True}, "deleted": {"$ne": True}},
        {"_id": 0}).sort("created_at", -1).limit(400)
    results = []
    async for m in cursor:
        att = m.get("attachment", {})
        hay = f"{att.get('filename','')} {att.get('extracted_text','')} {att.get('transcript','')}".lower()
        score = sum(1 for t in terms if t in hay) if terms else 1
        if score:
            sender = await db.users.find_one({"user_id": m["sender_id"]}, {"_id": 0})
            results.append({"score": score, "message_id": m["message_id"], "chat_id": m["chat_id"],
                            "filename": att.get("filename"), "kind": att.get("kind"),
                            "sender": ("You" if m["sender_id"] == user["user_id"] else (sender["name"] if sender else "Unknown")),
                            "ts": m["created_at"]})
    results.sort(key=lambda x: x["score"], reverse=True)
    return {"results": results[:30]}
