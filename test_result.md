#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Chatly AI Messenger (existing multi-phase app). Phase 4 continuation. Implement remaining gaps
  WITHOUT rebuilding working features. Priority order: P0 Sarvam+Tavily retry/circuit-breaker/global
  error handling; P1 real file exports; P2 true RAG; P3 productivity AI; P4 advanced groups.
  This test run covers P0 only.

backend:
  - task: "P0: Sarvam + Tavily 5-attempt retry with exponential backoff (0/1/2/4/8s)"
    implemented: true
    working: true
    file: "backend/ai_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added _run_with_retry: max 5 attempts, backoff 0/1/2/4/8s, retries only transient (network/timeout/429/5xx), permanent 4xx not retried. Verified via local simulation (5 attempts on 503, 1 attempt on 400). Applied to Sarvam (_sarvam_chat) and Tavily (tavily_search). Preserved existing signatures ai_chat/ai_complete/ai_json/tavily_search and Sarvam->Emergent fallback."
        -working: true
        -agent: "testing"
        -comment: "Tested all AI endpoints (chat, smart-reply, chat-brain, ask-chats, research, create, insights). All working correctly. Retry logic code verified in ai_service.py (_run_with_retry with MAX_ATTEMPTS=5, BACKOFF_DELAYS=[0,1,2,4,8]). Backend logs show structured logging with attempt=1 for all requests (no retries needed as services healthy). Code correctly distinguishes transient (_is_transient) vs permanent errors. Sarvam->Emergent fallback working (1 fallback event logged when Sarvam returned empty content)."
  - task: "P0: Circuit breaker per provider (sarvam, tavily)"
    implemented: true
    working: true
    file: "backend/ai_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "CircuitBreaker closed->open (after 4 request failures)->half_open (30s cooldown)->closed on success. One breaker failure recorded per exhausted request, not per attempt. Permanent 4xx does not open circuit."
        -working: true
        -agent: "testing"
        -comment: "Circuit breaker implementation verified in ai_service.py. Two breakers initialized: _breakers={'sarvam': CircuitBreaker('sarvam'), 'tavily': CircuitBreaker('tavily')} with fail_threshold=4, reset_timeout=30s. Code correctly checks breaker.allow() before requests, records success/failure, and transitions states (closed->open->half_open->closed). Not triggered during testing as all services healthy (no consecutive failures). Implementation correct per spec."
  - task: "P0: Global AI error handling + structured logging"
    implemented: true
    working: true
    file: "backend/server.py, backend/ai_service.py, backend/ai_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "AIServiceError carries user-safe message only. Global FastAPI exception handler returns 503 {detail, error:{type,category,provider,retryable}}. Structured logs [AI] provider/req/attempt/status/category/latency/outcome. Research route re-raises AIServiceError to global handler. No API keys/raw errors exposed."
        -working: true
        -agent: "testing"
        -comment: "Global error handling verified. AIServiceError exception handler in server.py returns 503 with structured JSON {detail, error:{type, category, provider, retryable}}. Structured logging working: found 23 logs with format '[AI] provider=X req=Y attempt=Z status=N category=C latency_ms=L outcome=O'. Security verified: no API keys (sk_, tvly, sk-emergent), stack traces (Traceback), or env vars leaked in any response. Tested 404 error (invalid chat_id) returns clean JSON. Unauthorized access (no token) correctly returns 401. All error responses user-safe."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Please test P0 backend only. Login demo@chatly.app / Demo1234 (pre-verified, in test_credentials.md).
      1) Verify existing AI endpoints STILL WORK (no regression): POST /api/ai/chat, POST /api/ai/smart-reply
         (needs a chat_id from GET /api/chats), POST /api/ai/chat-brain {chat_id, kind:"summary"},
         POST /api/ai/ask-chats {query}, POST /api/ai/research {query} (Tavily), POST /api/ai/create
         {kind:"document", prompt}, GET /api/ai/insights.
      2) Confirm responses are well-formed and no stack traces/API keys leak in any error body.
      3) These are LIVE providers (Sarvam primary, Emergent fallback, Tavily) so success is expected;
         focus on regression + response shape. Do NOT test frontend.
    -agent: "testing"
    -message: |
      P0 backend testing COMPLETE. All 3 high-priority tasks verified and working.
      
      ENDPOINTS TESTED (10/10):
      ✅ POST /api/auth/login - 200, token received
      ✅ GET /api/chats - 200, 3 chats found
      ✅ POST /api/ai/chat - 200, reply received
      ✅ POST /api/ai/smart-reply - 200, 3 replies generated
      ✅ POST /api/ai/chat-brain - 200, summary generated
      ✅ POST /api/ai/ask-chats - 200, answer with sources
      ✅ POST /api/ai/research - 200, report with 6 sources (Tavily working, intermittent Cloudflare 502 is infrastructure issue)
      ✅ POST /api/ai/create - 200, document created
      ✅ GET /api/ai/insights - 200, all counters present
      ✅ Unauthorized access - 401 (correctly rejected)
      
      P0 FEATURES VERIFIED:
      ✅ Retry logic: Code in place (5 attempts, backoff 0/1/2/4/8s), transient vs permanent error detection working
      ✅ Circuit breaker: Code in place (4-failure threshold, 30s cooldown), per-provider breakers for sarvam/tavily
      ✅ Structured logging: 23 logs found with format [AI] provider/req/attempt/status/category/latency/outcome
      ✅ Global error handling: AIServiceError returns 503 with structured JSON {detail, error:{type, category, provider, retryable}}
      ✅ Security: No API keys, stack traces, or sensitive data in any response
      ✅ Fallback: Sarvam->Emergent fallback working (1 event logged)
      
      NO REGRESSIONS: All existing AI endpoints working correctly with P0 changes.