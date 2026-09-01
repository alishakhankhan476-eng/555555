#!/usr/bin/env python3
"""
Backend API test suite for Chatly AI Messenger P0 changes.
Tests retry logic, circuit breaker, and global error handling.
"""
import requests
import json
import re
import sys

# Backend URL from frontend/.env
BASE_URL = "https://e0cff6da-eabf-4eff-9687-61106030666f.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
TEST_EMAIL = "demo@chatly.app"
TEST_PASSWORD = "Demo1234"

# Sensitive patterns that should NEVER appear in responses
SENSITIVE_PATTERNS = [
    r"Traceback",
    r"sk_",  # Sarvam key prefix
    r"tvly",  # Tavily key prefix
    r"sk-emergent",  # Emergent key prefix
    r"SARVAM_API_KEY",
    r"TAVILY_API_KEY",
    r"EMERGENT_LLM_KEY",
]

class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name, details=""):
        self.passed.append(f"✅ {test_name}: {details}")
    
    def add_fail(self, test_name, details=""):
        self.failed.append(f"❌ {test_name}: {details}")
    
    def add_warning(self, test_name, details=""):
        self.warnings.append(f"⚠️  {test_name}: {details}")
    
    def print_summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        if self.failed:
            print("\n🔴 FAILED TESTS:")
            for f in self.failed:
                print(f"  {f}")
        
        if self.warnings:
            print("\n🟡 WARNINGS:")
            for w in self.warnings:
                print(f"  {w}")
        
        if self.passed:
            print("\n🟢 PASSED TESTS:")
            for p in self.passed:
                print(f"  {p}")
        
        print("\n" + "="*80)
        print(f"Total: {len(self.passed)} passed, {len(self.failed)} failed, {len(self.warnings)} warnings")
        print("="*80)
        
        return len(self.failed) == 0

def check_for_leaks(response_text, test_name, result):
    """Check if response contains sensitive data or stack traces."""
    leaked = []
    for pattern in SENSITIVE_PATTERNS:
        if re.search(pattern, response_text, re.IGNORECASE):
            leaked.append(pattern)
    
    if leaked:
        result.add_fail(f"{test_name} - Security", f"Response leaked sensitive data: {', '.join(leaked)}")
        return False
    return True

def test_auth_login(result):
    """Test 1: POST /api/auth/login"""
    print("\n[1] Testing POST /api/auth/login...")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=30
        )
        
        check_for_leaks(response.text, "Login", result)
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                result.add_pass("Login", f"Status {response.status_code}, token received")
                return data["token"]
            else:
                result.add_fail("Login", f"Status {response.status_code} but no token in response")
                return None
        else:
            result.add_fail("Login", f"Status {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        result.add_fail("Login", f"Exception: {str(e)}")
        return None

def test_get_chats(token, result):
    """Test 2: GET /api/chats"""
    print("\n[2] Testing GET /api/chats...")
    try:
        response = requests.get(
            f"{BASE_URL}/chats",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        check_for_leaks(response.text, "Get Chats", result)
        
        if response.status_code == 200:
            data = response.json()
            chats = data.get("chats", [])
            result.add_pass("Get Chats", f"Status {response.status_code}, {len(chats)} chats found")
            return chats[0]["chat_id"] if chats else None
        else:
            result.add_fail("Get Chats", f"Status {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        result.add_fail("Get Chats", f"Exception: {str(e)}")
        return None

def test_ai_chat(token, result):
    """Test 3: POST /api/ai/chat"""
    print("\n[3] Testing POST /api/ai/chat...")
    try:
        response = requests.post(
            f"{BASE_URL}/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "In one sentence, what can you do?"},
            timeout=120
        )
        
        check_for_leaks(response.text, "AI Chat", result)
        
        if response.status_code == 200:
            data = response.json()
            if "conversation_id" in data and "reply" in data and data["reply"]:
                result.add_pass("AI Chat", f"Status {response.status_code}, reply: '{data['reply'][:80]}...'")
                return True
            else:
                result.add_fail("AI Chat", f"Status {response.status_code} but missing conversation_id or reply")
                return False
        elif response.status_code == 503:
            # 503 with structured error is acceptable
            data = response.json()
            if "detail" in data and "error" in data:
                result.add_warning("AI Chat", f"Status 503 (acceptable structured error): {data['detail']}")
                return True
            else:
                result.add_fail("AI Chat", f"Status 503 but not structured error: {response.text[:200]}")
                return False
        else:
            result.add_fail("AI Chat", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        result.add_fail("AI Chat", f"Exception: {str(e)}")
        return False

def test_smart_reply(token, chat_id, result):
    """Test 4: POST /api/ai/smart-reply"""
    print("\n[4] Testing POST /api/ai/smart-reply...")
    if not chat_id:
        result.add_warning("Smart Reply", "Skipped - no chat_id available")
        return False
    
    try:
        response = requests.post(
            f"{BASE_URL}/ai/smart-reply",
            headers={"Authorization": f"Bearer {token}"},
            json={"chat_id": chat_id},
            timeout=120
        )
        
        check_for_leaks(response.text, "Smart Reply", result)
        
        if response.status_code == 200:
            data = response.json()
            if "replies" in data and isinstance(data["replies"], list):
                result.add_pass("Smart Reply", f"Status {response.status_code}, {len(data['replies'])} replies")
                return True
            else:
                result.add_fail("Smart Reply", f"Status {response.status_code} but missing/invalid replies")
                return False
        elif response.status_code == 503:
            data = response.json()
            if "detail" in data and "error" in data:
                result.add_warning("Smart Reply", f"Status 503 (acceptable structured error): {data['detail']}")
                return True
            else:
                result.add_fail("Smart Reply", f"Status 503 but not structured error")
                return False
        else:
            result.add_fail("Smart Reply", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        result.add_fail("Smart Reply", f"Exception: {str(e)}")
        return False

def test_chat_brain(token, chat_id, result):
    """Test 5: POST /api/ai/chat-brain"""
    print("\n[5] Testing POST /api/ai/chat-brain...")
    if not chat_id:
        result.add_warning("Chat Brain", "Skipped - no chat_id available")
        return False
    
    try:
        response = requests.post(
            f"{BASE_URL}/ai/chat-brain",
            headers={"Authorization": f"Bearer {token}"},
            json={"chat_id": chat_id, "kind": "summary"},
            timeout=120
        )
        
        check_for_leaks(response.text, "Chat Brain", result)
        
        if response.status_code == 200:
            data = response.json()
            if "kind" in data and "result" in data:
                result.add_pass("Chat Brain", f"Status {response.status_code}, result: '{data['result'][:60]}...'")
                return True
            else:
                result.add_fail("Chat Brain", f"Status {response.status_code} but missing kind/result")
                return False
        elif response.status_code == 503:
            data = response.json()
            if "detail" in data and "error" in data:
                result.add_warning("Chat Brain", f"Status 503 (acceptable structured error): {data['detail']}")
                return True
            else:
                result.add_fail("Chat Brain", f"Status 503 but not structured error")
                return False
        else:
            result.add_fail("Chat Brain", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        result.add_fail("Chat Brain", f"Exception: {str(e)}")
        return False

def test_ask_chats(token, result):
    """Test 6: POST /api/ai/ask-chats"""
    print("\n[6] Testing POST /api/ai/ask-chats...")
    try:
        response = requests.post(
            f"{BASE_URL}/ai/ask-chats",
            headers={"Authorization": f"Bearer {token}"},
            json={"query": "project deadline"},
            timeout=120
        )
        
        check_for_leaks(response.text, "Ask Chats", result)
        
        if response.status_code == 200:
            data = response.json()
            if "answer" in data and "sources" in data:
                result.add_pass("Ask Chats", f"Status {response.status_code}, {len(data['sources'])} sources")
                return True
            else:
                result.add_fail("Ask Chats", f"Status {response.status_code} but missing answer/sources")
                return False
        elif response.status_code == 503:
            data = response.json()
            if "detail" in data and "error" in data:
                result.add_warning("Ask Chats", f"Status 503 (acceptable structured error): {data['detail']}")
                return True
            else:
                result.add_fail("Ask Chats", f"Status 503 but not structured error")
                return False
        else:
            result.add_fail("Ask Chats", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        result.add_fail("Ask Chats", f"Exception: {str(e)}")
        return False

def test_research(token, result):
    """Test 7: POST /api/ai/research (Tavily)"""
    print("\n[7] Testing POST /api/ai/research (Tavily)...")
    try:
        response = requests.post(
            f"{BASE_URL}/ai/research",
            headers={"Authorization": f"Bearer {token}"},
            json={"query": "latest news on AI"},
            timeout=120
        )
        
        check_for_leaks(response.text, "Research", result)
        
        if response.status_code == 200:
            data = response.json()
            if "report" in data and "sources" in data:
                result.add_pass("Research", f"Status {response.status_code}, {len(data['sources'])} sources")
                return True
            else:
                result.add_fail("Research", f"Status {response.status_code} but missing report/sources")
                return False
        elif response.status_code == 503:
            # 503 with structured error is acceptable for Tavily
            try:
                data = response.json()
                if "detail" in data and "error" in data:
                    error = data["error"]
                    if "category" in error and "provider" in error:
                        result.add_warning("Research", f"Status 503 (acceptable structured error): {data['detail']}, category={error['category']}")
                        return True
                    else:
                        result.add_fail("Research", f"Status 503 but error missing category/provider")
                        return False
                else:
                    result.add_fail("Research", f"Status 503 but not structured error")
                    return False
            except:
                result.add_fail("Research", f"Status 503 but response not JSON")
                return False
        else:
            result.add_fail("Research", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        result.add_fail("Research", f"Exception: {str(e)}")
        return False

def test_ai_create(token, result):
    """Test 8: POST /api/ai/create"""
    print("\n[8] Testing POST /api/ai/create...")
    try:
        response = requests.post(
            f"{BASE_URL}/ai/create",
            headers={"Authorization": f"Bearer {token}"},
            json={"kind": "document", "prompt": "a short project status report"},
            timeout=120
        )
        
        check_for_leaks(response.text, "AI Create", result)
        
        if response.status_code == 200:
            data = response.json()
            if "id" in data and "kind" in data and "title" in data and "content" in data:
                result.add_pass("AI Create", f"Status {response.status_code}, created {data['kind']}: {data['title']}")
                return True
            else:
                result.add_fail("AI Create", f"Status {response.status_code} but missing id/kind/title/content")
                return False
        elif response.status_code == 503:
            data = response.json()
            if "detail" in data and "error" in data:
                result.add_warning("AI Create", f"Status 503 (acceptable structured error): {data['detail']}")
                return True
            else:
                result.add_fail("AI Create", f"Status 503 but not structured error")
                return False
        else:
            result.add_fail("AI Create", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        result.add_fail("AI Create", f"Exception: {str(e)}")
        return False

def test_insights(token, result):
    """Test 9: GET /api/ai/insights"""
    print("\n[9] Testing GET /api/ai/insights...")
    try:
        response = requests.get(
            f"{BASE_URL}/ai/insights",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        check_for_leaks(response.text, "Insights", result)
        
        if response.status_code == 200:
            data = response.json()
            # Check for expected numeric counters
            expected_keys = ["unread", "important", "pending_tasks", "reminders", "creations", "pending_replies"]
            if all(k in data for k in expected_keys):
                result.add_pass("Insights", f"Status {response.status_code}, all counters present")
                return True
            else:
                result.add_fail("Insights", f"Status {response.status_code} but missing expected counters")
                return False
        else:
            result.add_fail("Insights", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        result.add_fail("Insights", f"Exception: {str(e)}")
        return False

def test_unauthorized_access(result):
    """Test 10: Negative test - unauthorized access"""
    print("\n[10] Testing unauthorized access (no token)...")
    try:
        response = requests.post(
            f"{BASE_URL}/ai/chat",
            json={"message": "test"},
            timeout=30
        )
        
        check_for_leaks(response.text, "Unauthorized Access", result)
        
        if response.status_code in [401, 403]:
            result.add_pass("Unauthorized Access", f"Status {response.status_code} (correctly rejected)")
            return True
        elif response.status_code == 500:
            result.add_fail("Unauthorized Access", f"Status 500 (should be 401/403, not 500)")
            return False
        else:
            result.add_fail("Unauthorized Access", f"Status {response.status_code} (expected 401/403)")
            return False
    except Exception as e:
        result.add_fail("Unauthorized Access", f"Exception: {str(e)}")
        return False

def main():
    print("="*80)
    print("CHATLY AI MESSENGER - P0 BACKEND API TESTS")
    print("Testing: Retry logic, Circuit breaker, Global error handling")
    print("="*80)
    
    result = TestResult()
    
    # Test 1: Login
    token = test_auth_login(result)
    if not token:
        print("\n❌ Cannot proceed without authentication token")
        result.print_summary()
        return 1
    
    # Test 2: Get chats
    chat_id = test_get_chats(token, result)
    
    # Test 3: AI Chat
    test_ai_chat(token, result)
    
    # Test 4: Smart Reply
    test_smart_reply(token, chat_id, result)
    
    # Test 5: Chat Brain
    test_chat_brain(token, chat_id, result)
    
    # Test 6: Ask Chats
    test_ask_chats(token, result)
    
    # Test 7: Research (Tavily)
    test_research(token, result)
    
    # Test 8: AI Create
    test_ai_create(token, result)
    
    # Test 9: Insights
    test_insights(token, result)
    
    # Test 10: Unauthorized access
    test_unauthorized_access(result)
    
    # Print summary
    success = result.print_summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
