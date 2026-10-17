import json
import os
import re
import time
import requests
from typing import Any, Dict, List, Optional, Tuple

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "gemma3")

_last_status_cache = None
_last_status_time = 0.0

def get_ollama_status() -> Dict[str, Any]:
    """Check if Ollama daemon is running and what models are pulled with quick 3s cache."""
    global _last_status_cache, _last_status_time
    now = time.time()
    if _last_status_cache is not None and (now - _last_status_time) < 3.0:
        return _last_status_cache

    try:
        res = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=0.6)
        if res.status_code == 200:
            data = res.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            has_gemma = any("gemma" in m.lower() for m in models)
            active = DEFAULT_MODEL
            if not has_gemma and models:
                active = models[0]
            _last_status_cache = {
                "connected": True,
                "host": OLLAMA_HOST,
                "models": models,
                "active_model": active,
                "has_target_model": any(DEFAULT_MODEL in m for m in models)
            }
            _last_status_time = now
            return _last_status_cache
    except Exception:
        pass

    _last_status_cache = {
        "connected": False,
        "host": OLLAMA_HOST,
        "models": [],
        "active_model": DEFAULT_MODEL,
        "has_target_model": False
    }
    _last_status_time = now
    return _last_status_cache

def clean_json_content(raw_text: str) -> Dict[str, Any]:
    """Extract and parse clean JSON from model output even with markdown fences."""
    text = raw_text.strip()
    # Strip markdown ```json or ``` blocks
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()
            
    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        # Try finding outermost { ... }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            sub = text[start:end+1]
            try:
                return json.loads(sub)
            except Exception:
                pass
    raise ValueError(f"Could not parse valid JSON from output: {raw_text[:200]}")

def call_ollama(
    messages: List[Dict[str, str]],
    format_schema: Optional[Any] = "json",
    model: Optional[str] = None,
    timeout: float = 35.0
) -> Dict[str, Any]:
    """
    Call local Ollama /api/chat with stream: False and structured json format.
    Raises ConnectionError if Ollama is unreachable.
    """
    target_model = model or DEFAULT_MODEL
    payload: Dict[str, Any] = {
        "model": target_model,
        "messages": messages,
        "stream": False
    }
    if format_schema is not None:
        payload["format"] = format_schema

    try:
        response = requests.post(
            f"{OLLAMA_HOST}/api/chat",
            json=payload,
            timeout=timeout
        )
        response.raise_for_status()
        res_json = response.json()
        content = res_json.get("message", {}).get("content", "")
        return clean_json_content(content)
    except requests.exceptions.ConnectionError as ce:
        raise ConnectionError(f"Ollama daemon not reachable at {OLLAMA_HOST}") from ce
    except Exception as e:
        raise RuntimeError(f"Ollama inference error: {str(e)}") from e

# --- Heuristic Fallback Engine ---
# Provides realistic offline simulation when Ollama is offline or model is still downloading

TACTIC_RESPONSES = [
    {
        "tactic": "comparison",
        "client_message": "Another developer on Upwork just quoted me ₹10,000 for this exact 5-page setup with payments. Why is your price so much higher?",
        "deal_status": "ongoing"
    },
    {
        "tactic": "scope creep",
        "client_message": "If I agree to your price, can you also bundle in free 1-year cloud hosting and unlimited design revisions until I am 100% happy?",
        "deal_status": "ongoing"
    },
    {
        "tactic": "urgency",
        "client_message": "I have the budget approved and can wire 50% immediately tomorrow morning, but you must commit to starting today and delivering by Sunday.",
        "deal_status": "ongoing"
    },
    {
        "tactic": "vague scope",
        "client_message": "Let's start with a rough prototype first without formal contracts or milestone splits. We can figure out exact deliverables and payment once I see the first draft.",
        "deal_status": "ongoing"
    },
    {
        "tactic": "price pressure",
        "client_message": "₹15,000 is literally the absolute ceiling my manager gave me. Take it or leave it, otherwise we'll have to go with our offshore agency.",
        "deal_status": "ongoing"
    }
]

def fallback_coach_scoring(setup, reply: str) -> Dict[str, Any]:
    """Smart local scoring engine when Ollama is offline."""
    reply_lower = reply.lower()
    
    # Defaults
    price_def = 7
    scope_prot = 7
    tone = 8
    overcommit = 2
    feedback = ""
    suggested = ""

    # Scope checks: unlimited revisions or free hosting
    if "unlimited" in reply_lower or "sure i can do that" in reply_lower or "yes i will include" in reply_lower or "free hosting" in reply_lower:
        scope_prot = 2
        overcommit = 9
        feedback = "Critical warning: You accepted scope creep (unlimited revisions/free addons). This creates immense risk of revision hell."
        suggested = f"I am happy to deliver the 5 core pages and payment integration. However, revisions are strictly limited to two rounds, and hosting is billed separately at cost."
    
    # Price concession checks
    elif any(kw in reply_lower for kw in ["i can do 10", "i can do 12", "i can reduce to", "i can give discount", "ok 8000", "deal at 10000"]):
        price_def = 3
        overcommit = 7
        feedback = "You conceded price too quickly without reducing the project scope. Always trade scope for price reductions."
        suggested = f"At that budget, we would need to scale down scope to 2 landing pages without payment gateway integration."
    
    # Strong defence
    elif "non-negotiable" in reply_lower or "milestone" in reply_lower or "two rounds" in reply_lower or "50%" in reply_lower:
        price_def = 9
        scope_prot = 9
        tone = 9
        overcommit = 1
        feedback = "Excellent stance. You clearly anchored your boundaries and justified value without becoming defensive."
        suggested = f"That sounds great. I'll send over the project agreement outlining the 50% advance and 7-day sprint once approved."
    
    else:
        # Balanced heuristic
        if len(reply.split()) < 8:
            tone = 5
            feedback = "Your reply is quite brief. Give a polite, firm justification when answering objections."
            suggested = "Thank you for the update. While I understand budget constraints, my quote reflects full QA testing, secure payment architecture, and a 7-day dedicated sprint."
        else:
            feedback = "Good professional tone. Keep reinforcing your minimum rate and advance payment requirement."
            suggested = f"I can lock in this schedule with a 50% advance deposit. Let me know if you would like me to share the contract."

    return {
        "score": {
            "price_defence": max(1, min(10, price_def)),
            "scope_protection": max(1, min(10, scope_prot)),
            "professional_tone": max(1, min(10, tone)),
            "overcommitment_risk": max(1, min(10, overcommit))
        },
        "feedback": feedback,
        "suggested_reply": suggested
    }

def fallback_client_turn(setup, round_number: int, reply: str) -> Dict[str, Any]:
    """Smart offline simulation turn."""
    reply_lower = reply.lower()
    
    # Check if agreement reached or deal walked away
    if round_number >= 4 and ("accept" in reply_lower or "agree" in reply_lower or "sounds good" in reply_lower):
        return {
            "client_message": "Understood. The terms make sense given the quality and quick delivery. Please send over the contract and 50% advance invoice so we can start.",
            "pressure_tactic": "none",
            "deal_status": "accepted"
        }
    
    if "walk away" in reply_lower or "cannot work together" in reply_lower or "wish you the best" in reply_lower:
        return {
            "client_message": "Fair enough. Appreciate your honesty regarding boundaries. We'll reach out if our budget expands in the future.",
            "pressure_tactic": "none",
            "deal_status": "walked away"
        }

    # Pick tactic by round or cycle
    idx = (round_number - 1) % len(TACTIC_RESPONSES)
    turn = TACTIC_RESPONSES[idx]
    
    return {
        "client_message": turn["client_message"],
        "pressure_tactic": turn["tactic"],
        "deal_status": turn["deal_status"]
    }

def fallback_final_plan(setup, turns: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate final plan offline."""
    quoted = setup.quoted_price
    floor = setup.minimum_price
    currency = setup.currency
    
    # Anchor between quoted and floor
    recommended = round((quoted * 0.7 + floor * 0.3) / 100) * 100
    if recommended < floor:
        recommended = floor

    boundaries = [
        "Require 50% upfront payment before any design or development begins.",
        "Strictly enforce maximum of 2 revision rounds in the Statement of Work.",
        f"Timeline fixed at {setup.deadline}; expedited delivery incurs +30% rush fee.",
        "Any additional features (hosting, extra pages, SEO audits) billed as separate line items."
    ]
    
    risks = [
        "Client anchored to ₹8,000–₹10,000 market pricing and may attempt scope expansion during build.",
        "Risk of unpaid revision requests unless deliverables are formally signed off per milestone.",
        "Client urgency ('start today') may be used to bypass formal contract signing."
    ]

    next_action = (
        f"Send the following written proposal: 'Hi, thank you for clarifying your goals. "
        f"To guarantee a production-grade 5-page site with secure payments, our fixed package is {currency} {recommended:,.0f} "
        f"delivered within {setup.deadline}. This includes 2 revision rounds and full mobile responsiveness. "
        f"Once the 50% deposit ({currency} {recommended*0.5:,.0f}) is in place, we kickoff on day 1. "
        f"Shall I share the milestone agreement?'"
    )

    return {
        "recommended_price": recommended,
        "currency": currency,
        "boundaries_in_writing": boundaries,
        "risks_identified": risks,
        "next_action": next_action,
        "deal_summary": f"Strong leverage retained. Minimum floor preserved ({currency} {floor:,.0f}) while offering clear structured milestones."
    }
