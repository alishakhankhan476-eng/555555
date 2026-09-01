import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field

from db import db
from security import hash_password, verify_password, create_token, get_current_user
from email_service import send_email, otp_email_html, reset_email_html

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

OTP_TTL_MIN = 10
RESEND_COOLDOWN_SEC = 45
MAX_OTP_ATTEMPTS = 5


def _now():
    return datetime.now(timezone.utc)


def _gen_otp() -> str:
    return f"{secrets.randbelow(1000000):06d}"


async def _issue_otp(user_id: str, email: str, name: str, purpose: str):
    """Invalidate previous OTP, create + email a new one. Enforces resend cooldown."""
    existing = await db.otps.find_one({"user_id": user_id, "purpose": purpose})
    if existing:
        last = existing.get("last_sent")
        if last:
            last_dt = datetime.fromisoformat(last)
            elapsed = (_now() - last_dt).total_seconds()
            if elapsed < RESEND_COOLDOWN_SEC:
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {int(RESEND_COOLDOWN_SEC - elapsed)}s before requesting a new code.",
                )
    code = _gen_otp()
    html = otp_email_html(name, code) if purpose == "verify" else reset_email_html(name, code)
    subject = "Your Chatly verification code" if purpose == "verify" else "Your Chatly password reset code"
    await send_email(to=email, subject=subject, html=html)
    await db.otps.delete_many({"user_id": user_id, "purpose": purpose})
    await db.otps.insert_one({
        "user_id": user_id,
        "purpose": purpose,
        "otp_hash": hash_password(code),
        "expires_at": (_now() + timedelta(minutes=OTP_TTL_MIN)).isoformat(),
        "attempts": 0,
        "last_sent": _now().isoformat(),
        "created_at": _now().isoformat(),
    })


async def _verify_otp(user_id: str, purpose: str, code: str) -> bool:
    rec = await db.otps.find_one({"user_id": user_id, "purpose": purpose})
    if not rec:
        raise HTTPException(status_code=400, detail="No code found. Please request a new code.")
    if datetime.fromisoformat(rec["expires_at"]) < _now():
        await db.otps.delete_many({"user_id": user_id, "purpose": purpose})
        raise HTTPException(status_code=400, detail="Code expired. Please request a new code.")
    if rec.get("attempts", 0) >= MAX_OTP_ATTEMPTS:
        await db.otps.delete_many({"user_id": user_id, "purpose": purpose})
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new code.")
    if not verify_password(code, rec["otp_hash"]):
        await db.otps.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        remaining = MAX_OTP_ATTEMPTS - (rec.get("attempts", 0) + 1)
        raise HTTPException(status_code=400, detail=f"Incorrect code. {max(remaining,0)} attempts left.")
    await db.otps.delete_many({"user_id": user_id, "purpose": purpose})
    return True


def _public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "name": u["name"],
        "email": u["email"],
        "username": u.get("username"),
        "bio": u.get("bio", ""),
        "avatar": u.get("avatar"),
        "email_verified": u.get("email_verified", False),
    }


class SignupBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class VerifyBody(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class EmailBody(BaseModel):
    email: EmailStr


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ResetBody(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=6, max_length=128)


@router.post("/signup")
async def signup(body: SignupBody):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email, "deleted_at": None})
    if existing:
        if existing.get("email_verified"):
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        # unverified — resend code
        await _issue_otp(existing["user_id"], email, existing["name"], "verify")
        return {"status": "otp_sent", "email": email}

    user_id = str(uuid.uuid4())
    username = email.split("@")[0] + secrets.token_hex(2)
    await db.users.insert_one({
        "user_id": user_id,
        "name": body.name.strip(),
        "email": email,
        "username": username,
        "bio": "",
        "avatar": None,
        "password": hash_password(body.password),
        "email_verified": False,
        "online": False,
        "last_seen": _now().isoformat(),
        "created_at": _now().isoformat(),
        "deleted_at": None,
    })
    # default privacy settings
    await db.privacy.update_one(
        {"user_id": user_id},
        {"$setOnInsert": {
            "user_id": user_id,
            "messages": True, "files": True, "memory": True, "contacts": True,
            "location": False, "calendar": True, "web_search": True, "calls": False,
            "images": True, "documents": True,
        }},
        upsert=True,
    )
    await _issue_otp(user_id, email, body.name.strip(), "verify")
    return {"status": "otp_sent", "email": email}


@router.post("/verify-otp")
async def verify_otp(body: VerifyBody):
    email = body.email.lower()
    user = await db.users.find_one({"email": email, "deleted_at": None})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")
    await _verify_otp(user["user_id"], "verify", body.code)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"email_verified": True}})
    token = create_token(user["user_id"])
    user["email_verified"] = True
    return {"token": token, "user": _public_user(user)}


@router.post("/resend-otp")
async def resend_otp(body: EmailBody):
    email = body.email.lower()
    user = await db.users.find_one({"email": email, "deleted_at": None})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")
    if user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email already verified.")
    await _issue_otp(user["user_id"], email, user["name"], "verify")
    return {"status": "otp_sent", "email": email}


@router.post("/login")
async def login(body: LoginBody):
    email = body.email.lower()
    user = await db.users.find_one({"email": email, "deleted_at": None})
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if not user.get("email_verified"):
        await _issue_otp(user["user_id"], email, user["name"], "verify")
        raise HTTPException(status_code=403, detail="Please verify your email first. We sent you a new code.")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_seen": _now().isoformat()}})
    token = create_token(user["user_id"])
    return {"token": token, "user": _public_user(user)}


@router.post("/forgot-password")
async def forgot_password(body: EmailBody):
    email = body.email.lower()
    user = await db.users.find_one({"email": email, "deleted_at": None})
    # Do not reveal whether the account exists, but still issue if it does.
    if user:
        try:
            await _issue_otp(user["user_id"], email, user["name"], "reset")
        except HTTPException as e:
            if e.status_code == 429:
                raise
    return {"status": "reset_sent", "email": email}


@router.post("/reset-password")
async def reset_password(body: ResetBody):
    email = body.email.lower()
    user = await db.users.find_one({"email": email, "deleted_at": None})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")
    await _verify_otp(user["user_id"], "reset", body.code)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"password": hash_password(body.new_password)}},
    )
    return {"status": "password_updated"}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": _public_user(user)}


class ProfileBody(BaseModel):
    name: str | None = None
    bio: str | None = None
    username: str | None = None
    avatar: str | None = None


@router.put("/me")
async def update_me(body: ProfileBody, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": _public_user(fresh)}


@router.delete("/me")
async def delete_me(user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"deleted_at": _now().isoformat(), "email_verified": False}},
    )
    return {"status": "deleted"}
