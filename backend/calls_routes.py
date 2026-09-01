import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel

from db import db
from security import get_current_user
from ws_manager import manager
from ai_service import ai_complete, ai_json
from media_service import transcribe_audio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["calls"])
CALL_SYS = ("You are Chatly analyzing an authorized call transcript. Never invent anything not in the transcript. "
            "If a speaker is uncertain, say so. Cite the call as the source.")


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _chat_of(chat_id: str, user_id: str) -> dict:
    chat = await db.chats.find_one({"chat_id": chat_id, "participants": user_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return chat


async def _call_for(call_id: str, user_id: str) -> dict:
    call = await db.calls.find_one({"call_id": call_id, "participants": user_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found.")
    return call


async def _name(uid: str) -> str:
    u = await db.users.find_one({"user_id": uid}, {"_id": 0})
    return u["name"] if u else "Unknown"


class StartCallBody(BaseModel):
    chat_id: str
    type: str = "voice"  # voice | video


@router.post("/calls")
async def start_call(body: StartCallBody, user: dict = Depends(get_current_user)):
    chat = await _chat_of(body.chat_id, user["user_id"])
    call_id = "call_" + uuid.uuid4().hex[:16]
    callees = [p for p in chat["participants"] if p != user["user_id"]]
    doc = {
        "call_id": call_id, "chat_id": body.chat_id, "type": body.type,
        "mode": "group" if chat["type"] == "group" else "dm",
        "caller_id": user["user_id"], "participants": chat["participants"],
        "accepted_by": [], "status": "ringing", "started_at": _now(),
        "connected_at": None, "ended_at": None, "duration": 0,
        "created_at": _now(),
    }
    await db.calls.insert_one(dict(doc))
    caller_name = user["name"]
    payload = {"type": "incoming_call", "call": {**{k: v for k, v in doc.items()},
               "caller_name": caller_name, "caller_avatar": user.get("avatar")}}
    for cid in callees:
        await manager.send_to_user(cid, payload)
    doc.pop("_id", None)
    return {"call": doc, "chat_type": chat["type"]}


@router.post("/calls/{call_id}/accept")
async def accept_call(call_id: str, user: dict = Depends(get_current_user)):
    call = await _call_for(call_id, user["user_id"])
    if call["status"] in ("ended", "rejected", "missed"):
        raise HTTPException(status_code=409, detail="Call already ended.")
    updates = {"status": "connected", "accepted_by": list(set(call.get("accepted_by", []) + [user["user_id"]]))}
    if not call.get("connected_at"):
        updates["connected_at"] = _now()
    await db.calls.update_one({"call_id": call_id}, {"$set": updates})
    for pid in call["participants"]:
        if pid != user["user_id"]:
            await manager.send_to_user(pid, {"type": "call_accepted", "call_id": call_id, "by": user["user_id"]})
    return {"status": "connected"}


@router.post("/calls/{call_id}/reject")
async def reject_call(call_id: str, user: dict = Depends(get_current_user)):
    call = await _call_for(call_id, user["user_id"])
    new_status = "rejected" if call["mode"] == "dm" else call["status"]
    await db.calls.update_one({"call_id": call_id}, {"$set": {"status": new_status, "ended_at": _now() if new_status == "rejected" else None}})
    for pid in call["participants"]:
        if pid != user["user_id"]:
            await manager.send_to_user(pid, {"type": "call_rejected", "call_id": call_id, "by": user["user_id"]})
    return {"status": new_status}


@router.post("/calls/{call_id}/end")
async def end_call(call_id: str, user: dict = Depends(get_current_user)):
    call = await _call_for(call_id, user["user_id"])
    if call["status"] == "ended":
        return {"status": "ended", "duration": call.get("duration", 0)}
    ended = _now()
    duration = 0
    if call.get("connected_at"):
        duration = int((datetime.fromisoformat(ended) - datetime.fromisoformat(call["connected_at"])).total_seconds())
    final = "ended" if call.get("connected_at") else ("missed" if call["status"] == "ringing" else call["status"])
    await db.calls.update_one({"call_id": call_id}, {"$set": {"status": final, "ended_at": ended, "duration": duration}})
    for pid in call["participants"]:
        if pid != user["user_id"]:
            await manager.send_to_user(pid, {"type": "call_ended", "call_id": call_id, "duration": duration, "final": final})
    return {"status": final, "duration": duration}


async def _call_view(call: dict, me: str) -> dict:
    others = [p for p in call["participants"] if p != me]
    if call["mode"] == "group":
        chat = await db.chats.find_one({"chat_id": call["chat_id"]}, {"_id": 0})
        peer = {"name": chat.get("name", "Group") if chat else "Group", "avatar": chat.get("avatar") if chat else None}
    else:
        peer = {"name": await _name(others[0]) if others else "Unknown",
                "user_id": others[0] if others else None,
                "avatar": (await db.users.find_one({"user_id": others[0]}, {"_id": 0}) or {}).get("avatar") if others else None}
    incoming = call["caller_id"] != me
    return {**call, "peer": peer, "direction": "incoming" if incoming else "outgoing",
            "has_transcript": bool(call.get("transcript"))}


@router.get("/calls")
async def call_history(user: dict = Depends(get_current_user)):
    cursor = db.calls.find({"participants": user["user_id"]}, {"_id": 0}).sort("started_at", -1).limit(100)
    out = []
    async for c in cursor:
        out.append(await _call_view(c, user["user_id"]))
    return {"calls": out}


@router.get("/calls/{call_id}")
async def get_call(call_id: str, user: dict = Depends(get_current_user)):
    call = await _call_for(call_id, user["user_id"])
    return {"call": await _call_view(call, user["user_id"])}


async def _call_ai_allowed(user_id: str) -> dict:
    p = await db.privacy.find_one({"user_id": user_id}, {"_id": 0}) or {}
    if p.get("call_intelligence", True) is False:
        raise HTTPException(status_code=403, detail="Call Intelligence is turned off in your privacy settings.")
    return p


@router.post("/calls/{call_id}/transcript")
async def upload_call_audio(call_id: str, file: UploadFile = File(...), language: str = Form("en"),
                            user: dict = Depends(get_current_user)):
    call = await _call_for(call_id, user["user_id"])
    p = await _call_ai_allowed(user["user_id"])
    if p.get("call_transcription", True) is False:
        raise HTTPException(status_code=403, detail="Call Transcription is turned off in your privacy settings.")
    data = await file.read()
    if not data or len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Recording must be under 25 MB.")
    try:
        transcript = await transcribe_audio(data, file.filename or "call.m4a", language)
    except Exception as e:
        logger.error(f"Call transcription failed: {e}")
        raise HTTPException(status_code=502, detail="Transcription failed. Please try again.")
    await db.calls.update_one({"call_id": call_id},
                              {"$set": {"transcript": transcript, "transcript_at": _now(), "transcribed_by": user["user_id"]}})
    return {"transcript": transcript}


class TranscriptTextBody(BaseModel):
    text: str


@router.post("/calls/{call_id}/transcript-text")
async def set_transcript_text(call_id: str, body: TranscriptTextBody, user: dict = Depends(get_current_user)):
    await _call_for(call_id, user["user_id"])
    await _call_ai_allowed(user["user_id"])
    await db.calls.update_one({"call_id": call_id},
                              {"$set": {"transcript": body.text.strip(), "transcript_at": _now(), "transcribed_by": user["user_id"]}})
    return {"transcript": body.text.strip()}


@router.get("/calls/{call_id}/transcript")
async def get_transcript(call_id: str, user: dict = Depends(get_current_user)):
    call = await _call_for(call_id, user["user_id"])
    return {"transcript": call.get("transcript", ""), "transcript_at": call.get("transcript_at")}


@router.delete("/calls/{call_id}/transcript")
async def delete_transcript(call_id: str, user: dict = Depends(get_current_user)):
    await _call_for(call_id, user["user_id"])
    await db.calls.update_one({"call_id": call_id},
                              {"$unset": {"transcript": "", "transcript_at": "", "summary": "", "insights": ""}})
    return {"status": "deleted"}


class CallAIBody(BaseModel):
    action: str  # summary | tasks | ask
    question: str | None = None


@router.post("/calls/{call_id}/ai")
async def call_ai(call_id: str, body: CallAIBody, user: dict = Depends(get_current_user)):
    call = await _call_for(call_id, user["user_id"])
    p = await _call_ai_allowed(user["user_id"])
    transcript = call.get("transcript", "")
    if not transcript.strip():
        raise HTTPException(status_code=400, detail="No transcript yet. Add call notes or a recording first.")
    peer = (await _call_view(call, user["user_id"]))["peer"]["name"]
    source = f"Call with {peer} · {call['started_at'][:16].replace('T',' ')}"

    if body.action == "summary":
        if p.get("call_summary", True) is False:
            raise HTTPException(status_code=403, detail="Call Summary is turned off in your privacy settings.")
        data = await ai_json(
            CALL_SYS + " Produce a structured JSON summary.",
            f"Transcript of a call with {peer}:\n{transcript}\n\nReturn JSON: {{\"summary\": \"...\", "
            f"\"key_points\": [\"...\"], \"decisions\": [\"...\"], \"action_items\": [\"...\"], "
            f"\"deadlines\": [\"...\"], \"follow_ups\": [\"...\"], \"questions\": [\"...\"]}}", max_tokens=1600)
        await db.calls.update_one({"call_id": call_id}, {"$set": {"summary": data, "summary_at": _now()}})
        return {"summary": data, "source": source}

    if body.action == "tasks":
        data = await ai_json(
            CALL_SYS + " Extract only real tasks/deadlines/follow-ups present in the transcript.",
            f"Transcript:\n{transcript}\n\nReturn JSON: {{\"items\": [{{\"type\": \"task|deadline|followup|meeting\", "
            f"\"title\": \"...\", \"owner\": \"name or empty\", \"when\": \"natural date or empty\"}}]}}", max_tokens=1000)
        items = data.get("items", []) if isinstance(data, dict) else []
        return {"items": items, "source": source}

    answer = await ai_complete(CALL_SYS, f"Transcript of the call with {peer}:\n{transcript}\n\nQuestion: {body.question or 'Summarize.'}\n\nAnswer using only the transcript and cite the call.",
                               temperature=0.3, max_tokens=900)
    return {"answer": answer.strip(), "source": source}


# ---- confirmed action creators (calendar collection) ----
class CalEventBody(BaseModel):
    title: str
    when: str | None = None
    location: str | None = None
    source_call_id: str | None = None


@router.post("/calendar")
async def create_calendar_event(body: CalEventBody, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["user_id"], "title": body.title.strip(),
           "when": body.when, "location": body.location, "source_call_id": body.source_call_id,
           "created_at": _now()}
    await db.calendar_events.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.get("/calendar")
async def list_calendar(user: dict = Depends(get_current_user)):
    cursor = db.calendar_events.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(100)
    return {"events": [e async for e in cursor]}


class CallSearchBody(BaseModel):
    query: str


@router.post("/calls/search")
async def search_calls(body: CallSearchBody, user: dict = Depends(get_current_user)):
    await _call_ai_allowed(user["user_id"])
    terms = [t for t in body.query.lower().split() if len(t) > 2]
    cursor = db.calls.find({"participants": user["user_id"], "transcript": {"$exists": True}}, {"_id": 0}).sort("started_at", -1).limit(200)
    out = []
    async for c in cursor:
        hay = (c.get("transcript", "") + " " + str(c.get("summary", ""))).lower()
        score = sum(1 for t in terms if t in hay) if terms else 1
        if score:
            out.append(await _call_view(c, user["user_id"]))
    return {"calls": out[:20]}
