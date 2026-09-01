"""Phase 3 tests: Call lifecycle, authorization, AI intelligence, privacy, calendar,
regression on Phase 1/2 must-still-pass endpoints."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@chatly.app"
DEMO_PASS = "Demo1234"


# ---- Fixtures ----
@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def jheaders(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def rahul_chat_id(jheaders):
    r = requests.get(f"{API}/chats", headers=jheaders, timeout=15)
    assert r.status_code == 200
    for c in r.json()["chats"]:
        if c.get("type") != "group" and "Rahul" in (c.get("other") or {}).get("name", ""):
            return c["chat_id"]
    pytest.skip("Rahul DM missing")


# ---- Call lifecycle ----
class TestCallLifecycle:
    def test_start_voice_call(self, jheaders, rahul_chat_id):
        r = requests.post(f"{API}/calls", json={"chat_id": rahul_chat_id, "type": "voice"},
                          headers=jheaders, timeout=15)
        assert r.status_code == 200, r.text
        call = r.json()["call"]
        assert call["status"] == "ringing"
        assert call["type"] == "voice"
        assert call["mode"] == "dm"
        assert len(call["participants"]) == 2
        TestCallLifecycle._call = call

    def test_get_call_details(self, jheaders):
        cid = TestCallLifecycle._call["call_id"]
        r = requests.get(f"{API}/calls/{cid}", headers=jheaders, timeout=10)
        assert r.status_code == 200
        c = r.json()["call"]
        assert c["call_id"] == cid
        assert c["peer"]["name"]  # peer resolved
        assert c["direction"] == "outgoing"

    def test_accept_call(self, jheaders):
        cid = TestCallLifecycle._call["call_id"]
        r = requests.post(f"{API}/calls/{cid}/accept", headers=jheaders, timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "connected"

    def test_end_connected_call_returns_ended(self, jheaders):
        cid = TestCallLifecycle._call["call_id"]
        time.sleep(1)
        r = requests.post(f"{API}/calls/{cid}/end", headers=jheaders, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "ended"
        assert isinstance(d["duration"], int) and d["duration"] >= 0

    def test_start_and_reject_call(self, jheaders, rahul_chat_id):
        r = requests.post(f"{API}/calls", json={"chat_id": rahul_chat_id, "type": "video"},
                          headers=jheaders, timeout=15)
        cid = r.json()["call"]["call_id"]
        r2 = requests.post(f"{API}/calls/{cid}/reject", headers=jheaders, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["status"] == "rejected"

    def test_end_ringing_becomes_missed(self, jheaders, rahul_chat_id):
        r = requests.post(f"{API}/calls", json={"chat_id": rahul_chat_id, "type": "voice"},
                          headers=jheaders, timeout=10)
        cid = r.json()["call"]["call_id"]
        r2 = requests.post(f"{API}/calls/{cid}/end", headers=jheaders, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["status"] == "missed"

    def test_call_history_newest_first(self, jheaders):
        r = requests.get(f"{API}/calls", headers=jheaders, timeout=10)
        assert r.status_code == 200
        calls = r.json()["calls"]
        assert len(calls) >= 3
        # newest-first
        starts = [c["started_at"] for c in calls]
        assert starts == sorted(starts, reverse=True)
        for c in calls[:3]:
            assert "peer" in c and "direction" in c and "has_transcript" in c


# ---- Authorization / Security ----
class TestCallAuth:
    def test_calls_require_bearer(self):
        for method, path, body in [
            ("GET", "/calls", None),
            ("POST", "/calls", {"chat_id": "x", "type": "voice"}),
            ("GET", "/calls/anything", None),
            ("POST", "/calls/anything/accept", {}),
            ("POST", "/calls/anything/end", {}),
        ]:
            r = requests.request(method, f"{API}{path}", json=body, timeout=10)
            assert r.status_code in (401, 403), f"{method} {path} -> {r.status_code}"

    def test_start_call_with_foreign_chat_id_404(self, jheaders):
        r = requests.post(f"{API}/calls",
                          json={"chat_id": "chat_does_not_exist_" + uuid.uuid4().hex, "type": "voice"},
                          headers=jheaders, timeout=10)
        assert r.status_code == 404

    def test_get_call_for_non_participant_404(self, jheaders):
        r = requests.get(f"{API}/calls/call_bogus_{uuid.uuid4().hex}",
                         headers=jheaders, timeout=10)
        assert r.status_code == 404


# ---- Call AI intelligence ----
class TestCallAI:
    @pytest.fixture(scope="class")
    def call_with_transcript(self, jheaders, rahul_chat_id):
        # Fresh call
        r = requests.post(f"{API}/calls", json={"chat_id": rahul_chat_id, "type": "voice"},
                          headers=jheaders, timeout=10)
        call_id = r.json()["call"]["call_id"]
        requests.post(f"{API}/calls/{call_id}/accept", headers=jheaders, timeout=10)
        # Add transcript text
        transcript = (
            "Alice: Hi Rahul, thanks for calling. Let's discuss the Q1 marketing plan.\n"
            "Rahul: Sure. We need to finalize the budget of $50,000 by January 31, 2026.\n"
            "Alice: Agreed. I'll send the draft proposal by Friday.\n"
            "Rahul: Also, please schedule a follow-up meeting next Monday at 3pm.\n"
            "Alice: Will do. Any other action items?\n"
            "Rahul: Yes, ask the design team to prepare mockups by January 25."
        )
        r2 = requests.post(f"{API}/calls/{call_id}/transcript-text",
                           json={"text": transcript}, headers=jheaders, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["transcript"].startswith("Alice:")
        # End the call
        requests.post(f"{API}/calls/{call_id}/end", headers=jheaders, timeout=10)
        return call_id

    def test_get_transcript(self, jheaders, call_with_transcript):
        r = requests.get(f"{API}/calls/{call_with_transcript}/transcript",
                         headers=jheaders, timeout=10)
        assert r.status_code == 200
        assert "Q1 marketing" in r.json()["transcript"]

    def test_ai_summary(self, jheaders, call_with_transcript):
        r = requests.post(f"{API}/calls/{call_with_transcript}/ai",
                          json={"action": "summary"}, headers=jheaders, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "source" in d
        s = d["summary"]
        for k in ["summary", "key_points", "decisions", "action_items", "deadlines", "follow_ups", "questions"]:
            assert k in s, f"Missing summary key: {k}"

    def test_ai_tasks(self, jheaders, call_with_transcript):
        r = requests.post(f"{API}/calls/{call_with_transcript}/ai",
                          json={"action": "tasks"}, headers=jheaders, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d and isinstance(d["items"], list)
        assert "source" in d
        if d["items"]:
            it = d["items"][0]
            for k in ["type", "title", "owner", "when"]:
                assert k in it

    def test_ai_ask(self, jheaders, call_with_transcript):
        r = requests.post(f"{API}/calls/{call_with_transcript}/ai",
                          json={"action": "ask", "question": "What is the budget?"},
                          headers=jheaders, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "answer" in d and len(d["answer"]) > 0
        assert "source" in d and "Call with" in d["source"]

    def test_call_search_finds_transcript(self, jheaders, call_with_transcript):
        r = requests.post(f"{API}/calls/search", json={"query": "marketing budget"},
                          headers=jheaders, timeout=15)
        assert r.status_code == 200
        calls = r.json()["calls"]
        assert any(c["call_id"] == call_with_transcript for c in calls)

    def test_delete_transcript(self, jheaders, call_with_transcript):
        r = requests.delete(f"{API}/calls/{call_with_transcript}/transcript",
                            headers=jheaders, timeout=10)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/calls/{call_with_transcript}/transcript",
                          headers=jheaders, timeout=10)
        assert r2.json().get("transcript", "") == ""

    def test_ai_without_transcript_returns_400(self, jheaders, call_with_transcript):
        r = requests.post(f"{API}/calls/{call_with_transcript}/ai",
                          json={"action": "summary"}, headers=jheaders, timeout=30)
        assert r.status_code == 400


# ---- Privacy gating ----
class TestCallPrivacy:
    def test_privacy_has_call_keys(self, jheaders):
        r = requests.get(f"{API}/ai/privacy", headers=jheaders, timeout=10)
        assert r.status_code == 200
        p = r.json()["privacy"]
        for k in ["call_intelligence", "call_transcription", "call_summary", "call_memory"]:
            assert k in p, f"Missing privacy key {k}. Got {list(p.keys())}"
            assert p[k] is True  # defaults

    def test_disable_call_intelligence_blocks_ai(self, jheaders, rahul_chat_id):
        # Setup transcript on a fresh call
        r0 = requests.post(f"{API}/calls", json={"chat_id": rahul_chat_id, "type": "voice"},
                           headers=jheaders, timeout=10)
        cid = r0.json()["call"]["call_id"]
        requests.post(f"{API}/calls/{cid}/transcript-text",
                      json={"text": "TEST privacy transcript with content"},
                      headers=jheaders, timeout=10)
        # Turn off call_intelligence
        r1 = requests.put(f"{API}/ai/privacy", json={"call_intelligence": False},
                          headers=jheaders, timeout=10)
        assert r1.status_code == 200
        # AI now 403
        r2 = requests.post(f"{API}/calls/{cid}/ai", json={"action": "summary"},
                           headers=jheaders, timeout=30)
        assert r2.status_code == 403
        # Re-enable
        r3 = requests.put(f"{API}/ai/privacy", json={"call_intelligence": True},
                          headers=jheaders, timeout=10)
        assert r3.status_code == 200
        r4 = requests.post(f"{API}/calls/{cid}/ai", json={"action": "summary"},
                           headers=jheaders, timeout=90)
        assert r4.status_code == 200


# ---- Calendar ----
class TestCalendar:
    def test_create_and_list_calendar_event(self, jheaders):
        title = "TEST_Meeting_" + uuid.uuid4().hex[:6]
        r = requests.post(f"{API}/calendar",
                          json={"title": title, "when": "2026-02-01 15:00"},
                          headers=jheaders, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == title and "id" in d
        # List
        r2 = requests.get(f"{API}/calendar", headers=jheaders, timeout=10)
        assert r2.status_code == 200
        events = r2.json()["events"]
        assert any(e["title"] == title for e in events)


# ---- Regression on Phase 1/2 must-still-pass ----
class TestRegression:
    def test_login(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=15)
        assert r.status_code == 200 and "token" in r.json()

    def test_chats_has_dm_and_group(self, jheaders):
        r = requests.get(f"{API}/chats", headers=jheaders, timeout=15)
        assert r.status_code == 200
        chats = r.json()["chats"]
        assert len(chats) > 0

    def test_send_message(self, jheaders, rahul_chat_id):
        r = requests.post(f"{API}/chats/{rahul_chat_id}/messages",
                          json={"text": "TEST_regression_msg"},
                          headers=jheaders, timeout=15)
        assert r.status_code == 200
        assert r.json()["message"]["text"].startswith("TEST_")

    def test_smart_reply(self, jheaders, rahul_chat_id):
        r = requests.post(f"{API}/ai/smart-reply",
                          json={"chat_id": rahul_chat_id},
                          headers=jheaders, timeout=60)
        assert r.status_code == 200
        assert isinstance(r.json().get("suggestions") or r.json().get("replies"), list)

    def test_chat_brain_summary(self, jheaders, rahul_chat_id):
        r = requests.post(f"{API}/ai/chat-brain",
                          json={"chat_id": rahul_chat_id, "kind": "summary"},
                          headers=jheaders, timeout=90)
        assert r.status_code == 200
        assert r.json().get("result")

    def test_ai_chat(self, jheaders):
        r = requests.post(f"{API}/ai/chat",
                          json={"message": "Say hello"},
                          headers=jheaders, timeout=60)
        assert r.status_code == 200

    def test_user_search(self, jheaders):
        r = requests.get(f"{API}/users/search", params={"q": "Rahul"},
                         headers=jheaders, timeout=10)
        assert r.status_code == 200
        assert any("Rahul" in u["name"] for u in r.json()["users"])

    def test_contacts_list_has_three(self, jheaders):
        r = requests.get(f"{API}/contacts/list", headers=jheaders, timeout=10)
        assert r.status_code == 200
        assert len(r.json()["contacts"]) >= 3
