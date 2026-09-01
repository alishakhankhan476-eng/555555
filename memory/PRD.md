# Chatly AI Messenger — PRD & Build Log

## Original Problem Statement
Build "Chatly AI Messenger" — an AI-native real-time messaging + personal AI + productivity + research + document intelligence platform (Android-first, iOS-ready, web-ready backend). Chatly AI is deeply integrated into messaging, groups, files, search, research, productivity and workflows. NOT a WhatsApp clone — positioned as "an AI-native communication operating system."

## User Choices (v1)
- MVP focus: Messaging + Chatly AI + AI intelligence (broad foundation)
- Auth: Email + Password with backend Email OTP verification (Emergent-managed email)
- AI provider: Sarvam AI (`sarvam-105b`) primary, Emergent universal LLM as fallback
- Realtime: WebSocket
- Theme: Light + Dark + System (bright orange #FF5E00 accent)

## Architecture
- Frontend: Expo Router (React Native), theme/auth/ws/toast providers, Ionicons, expo-image, expo-linear-gradient.
- Backend: FastAPI + MongoDB (motor), JWT auth (bcrypt), WebSocket manager, provider-agnostic AI layer.
- AI: Sarvam AI chat completions (reasoning model — output budget padded + reasoning_effort low), Tavily web search, Emergent email for OTP, Emergent LLM fallback.
- Data isolation: every endpoint verifies Bearer token + ownership (participants / user_id).

## User Personas
- Busy professional who wants AI to turn messages into tasks, summaries, replies.
- Student/knowledge worker using Chatly for research, documents, and productivity.

## Implemented (2026-06 / iteration 1)
- Auth: signup, 6-digit email OTP (hashed, single-use, expiry, resend cooldown, max attempts, rate limit), login (unverified handling), forgot/reset password, me/update/delete. Pre-verified demo account `demo@chatly.app` / `Demo1234`.
- Messaging: chats list, 1-to-1 chat, send/receive over WebSocket, optimistic send, typing indicator, message states, reactions, star, edit, delete, pin, mute. Seeded AI persona contacts (Rahul/Priya/Aman) that auto-reply via Sarvam.
- Chatly AI: assistant chat (persisted conversations), smart reply, message actions (rewrite/improve/grammar/translate/summarize/explain/shorten/expand/tone), chat brain (summary/important/timeline/pending/decisions/find), task/deadline extraction.
- Intelligence: Ask Your Chats (cross-chat search + cited sources), Deep Research (Tavily + cited report + history).
- Creation Studio: documents/presentations/spreadsheets/notes/checklist/plan; artifact library + viewer.
- Productivity: tasks CRUD, reminders CRUD, important messages, AI insights dashboard.
- AI Memory (user-controlled), AI Privacy Control Center (per-feature access toggles).
- Tabs: Chats, Chatly (dashboard), Status, Calls, Profile. Settings, Privacy, Memory, Creations screens.
- Theming light/dark/system; polished empty/loading/error states throughout.

## Testing (iteration 1)
- Backend: 30/30 pytest passing. Frontend: full login→chat→AI flows verified. Report: /app/test_reports/iteration_1.json.

## Implemented — Phase 1 & 2 (2026-06 / iteration 2)
- Google Sign-In/Sign-Up (Emergent OAuth): POST /api/auth/session upserts by email (no duplicates), issues existing JWT; frontend "Continue with Google" (web + mobile).
- Real user-to-user: /api/users/search, contact requests (send/accept/reject, mutual auto-accept), /api/contacts/list, block. New Chat searches real users; demo<->persona seeded as contacts.
- Photo & file sharing: Emergent Object Storage (storage_service.py), private, token-gated /api/files/{path} with participant check; upload via /api/chats/{id}/attachments.
- Attachment Intelligence: doc text extraction (pypdf/python-docx/openpyxl/csv/txt) + image vision/OCR (gpt-4o); /api/ai/attachment actions with source citation; /api/ai/attachment-search.
- Groups + Group Brain: /api/groups CRUD, roles, add/remove/leave; reuse chat/messages + WS; Group Brain via /api/ai/chat-brain. New Group + Group Info screens.
- Voice messages: expo-audio record -> /api/chats/{id}/voice -> Whisper transcription; voice bubble + transcript; attachment AI applies.
- Privacy Center: added attachments/images/documents/voice_messages/group_intelligence toggles. app.json camera/mic/photos permissions. Bundle IDs unchanged.

## Testing (iteration 2)
- Backend 35/35 after contacts-seed fix. Frontend Phase-1/2 surfaces verified. Report: /app/test_reports/iteration_2.json.

## Still Pending (next)
- 2FA/biometric lock, disappearing messages, push notifications (device build).
- Voice->smart-reply chips, group polls/announcements/pinned UI, conversation-aware web search, automations, admin dashboard, export PPTX/PDF/XLSX, E2EE.

## Backlog (prioritized)
- P0: Real 2-user messaging (currently single-user + AI persona demo), image/file attachments via Object Storage, push notifications.
- P1: Groups + Group Brain, Status media, Voice (STT/TTS) + voice-to-message, document upload & PDF intelligence (RAG), automations engine, follow-up tracker.
- P2: Voice/video calls (WebRTC, device build), Google Sign-In, 2FA/biometric lock, admin dashboard, export PPTX/PDF/XLSX, scam shield, link intelligence.

## Notes
- Email OTP delivers only to real addresses (provider blocks fake domains). Real users' emails work.
- Sarvam is a reasoning model; ai_service pads token budget and retries once on empty output.
