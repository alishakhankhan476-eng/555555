"""Provider-agnostic AI layer. Sarvam AI is primary; Emergent universal LLM is fallback.
Also wraps Tavily web search. All secrets stay server-side only."""
import os
import json
import logging
import httpx

logger = logging.getLogger(__name__)

SARVAM_API_KEY = os.environ["SARVAM_API_KEY"]
SARVAM_MODEL = os.environ.get("SARVAM_MODEL", "sarvam-105b")
SARVAM_URL = "https://api.sarvam.ai/v1/chat/completions"
TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]
TAVILY_URL = "https://api.tavily.com/search"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


async def _sarvam_chat(messages: list[dict], temperature: float = 0.5, max_tokens: int = 1200) -> str:
    # sarvam-105b is a reasoning model: reasoning_content consumes the token budget
    # before content is produced. Add generous headroom + low effort so `content`
    # is never truncated to empty (finish_reason="length").
    payload = {
        "model": SARVAM_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens + 2500,
        "reasoning_effort": "low",
    }
    async with httpx.AsyncClient(timeout=120) as c:
        resp = await c.post(
            SARVAM_URL,
            headers={"Content-Type": "application/json", "api-subscription-key": SARVAM_API_KEY},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return (data["choices"][0]["message"]["content"] or "").strip()


async def _emergent_chat(messages: list[dict]) -> str:
    """Fallback using the Emergent universal key (Claude)."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    system = "You are Chatly, a helpful AI assistant."
    convo = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            convo.append(m)
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id="chatly-fallback", system_message=system).with_model(
        "anthropic", "claude-sonnet-4-6"
    )
    # send the last user turn (history is small for our use-cases)
    text = "\n".join([f"{m['role']}: {m['content']}" for m in convo]) if len(convo) > 1 else convo[-1]["content"]
    resp = await chat.send_message(UserMessage(text=text))
    return (resp or "").strip()


async def ai_chat(messages: list[dict], temperature: float = 0.5, max_tokens: int = 1200) -> str:
    """Primary Sarvam, fallback Emergent. `messages` is OpenAI-style list of {role, content}."""
    try:
        out = await _sarvam_chat(messages, temperature, max_tokens)
        if not out:  # reasoning consumed budget — retry once with more headroom
            out = await _sarvam_chat(messages, temperature, max_tokens + 2000)
        if out:
            return out
        raise ValueError("empty content")
    except Exception as e:
        logger.warning(f"Sarvam failed ({e}); using Emergent fallback")
        try:
            return await _emergent_chat(messages)
        except Exception as e2:
            logger.error(f"AI fallback also failed: {e2}")
            raise


async def ai_complete(system: str, prompt: str, temperature: float = 0.5, max_tokens: int = 1200) -> str:
    return await ai_chat(
        [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        temperature,
        max_tokens,
    )


async def ai_json(system: str, prompt: str, max_tokens: int = 1500) -> dict | list:
    """Ask the model for strict JSON and parse it defensively."""
    sys = system + "\n\nRespond with ONLY valid JSON. No markdown, no code fences, no commentary."
    raw = await ai_chat(
        [{"role": "system", "content": sys}, {"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=max_tokens,
    )
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1] if "```" in raw else raw
        raw = raw.replace("json", "", 1).strip() if raw.lstrip().startswith("json") else raw
    # extract first { or [ ... to last } or ]
    start = min([i for i in [raw.find("{"), raw.find("[")] if i != -1] or [0])
    end = max(raw.rfind("}"), raw.rfind("]"))
    if end != -1:
        raw = raw[start:end + 1]
    try:
        return json.loads(raw)
    except Exception as e:
        logger.error(f"JSON parse failed: {e}; raw={raw[:400]}")
        return {}


async def tavily_search(query: str, max_results: int = 6) -> dict:
    payload = {
        "api_key": TAVILY_API_KEY,
        "query": query,
        "max_results": max_results,
        "include_answer": True,
        "search_depth": "advanced",
    }
    async with httpx.AsyncClient(timeout=60) as c:
        resp = await c.post(TAVILY_URL, json=payload)
        resp.raise_for_status()
        return resp.json()
