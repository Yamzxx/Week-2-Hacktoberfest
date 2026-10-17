import json
import os
import requests
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

try:
    from .schemas import (
        DealSetup,
        FreelancerReply,
        ClientTurn,
        NegotiationStepRequest,
        NegotiationStepResponse,
        FinalPlanRequest,
        FinalPlanResponse
    )
    from .prompts import (
        format_client_prompt,
        format_coach_prompt,
        format_plan_prompt,
        CLIENT_SIMULATOR_PROMPT_TEMPLATE,
        COACH_PROMPT_TEMPLATE
    )
    from .ollama_client import (
        call_ollama,
        get_ollama_status,
        fallback_coach_scoring,
        fallback_client_turn,
        fallback_final_plan,
        OLLAMA_HOST,
        DEFAULT_MODEL
    )
except (ImportError, ValueError):
    from schemas import (
        DealSetup,
        FreelancerReply,
        ClientTurn,
        NegotiationStepRequest,
        NegotiationStepResponse,
        FinalPlanRequest,
        FinalPlanResponse
    )
    from prompts import (
        format_client_prompt,
        format_coach_prompt,
        format_plan_prompt,
        CLIENT_SIMULATOR_PROMPT_TEMPLATE,
        COACH_PROMPT_TEMPLATE
    )
    from ollama_client import (
        call_ollama,
        get_ollama_status,
        fallback_coach_scoring,
        fallback_client_turn,
        fallback_final_plan,
        OLLAMA_HOST,
        DEFAULT_MODEL
    )

app = FastAPI(
    title="DealGuard API",
    description="Local-first AI Negotiation Simulator and Coach for Freelancers",
    version="1.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
def api_status():
    """Get system and Ollama status."""
    ollama_info = get_ollama_status()
    return {
        "status": "online",
        "service": "DealGuard",
        "ollama": ollama_info,
        "engine": "ollama" if ollama_info["connected"] else "simulation"
    }

@app.post("/api/client-turn")
def client_turn(payload: dict):
    """
    Direct client turn endpoint following user specification.
    Accepts messages and format_schema, forwards to Ollama /api/chat.
    """
    model = payload.get("model", DEFAULT_MODEL)
    messages = payload.get("messages", [])
    format_schema = payload.get("format_schema", "json")
    
    ollama_status = get_ollama_status()
    if ollama_status["connected"]:
        try:
            return call_ollama(messages, format_schema=format_schema, model=model)
        except Exception as e:
            # If Ollama fails midway, fallback gracefully
            pass
            
    # Fallback simulation
    last_msg = messages[-1]["content"] if messages else ""
    return {
        "client_message": "Another developer offered to do this for ₹10,000. Can you match that and throw in revisions?",
        "pressure_tactic": "comparison",
        "deal_status": "ongoing"
    }

@app.post("/api/coach-score")
def coach_score(payload: dict):
    """Scoring endpoint directly for coach evaluations."""
    setup_data = payload.get("setup", {})
    reply = payload.get("reply", "")
    setup = DealSetup(**setup_data)
    
    ollama_status = get_ollama_status()
    if ollama_status["connected"]:
        try:
            coach_prompt = format_coach_prompt(setup, reply)
            messages = [{"role": "user", "content": coach_prompt}]
            return call_ollama(messages, format_schema="json")
        except Exception:
            pass

    return fallback_coach_scoring(setup, reply)

@app.post("/api/negotiate/step", response_model=NegotiationStepResponse)
def negotiate_step(req: NegotiationStepRequest):
    """
    Orchestrates the two separate AI jobs:
    1. Coach: Scores the freelancer's reply (price_defence, scope_protection, tone, overcommitment_risk)
    2. Client Simulator: Produces the client's next response and pressure tactic
    """
    setup = req.setup
    reply = req.reply
    round_num = req.round_number
    history = req.conversation_history

    ollama_status = get_ollama_status()
    is_ollama = ollama_status["connected"]

    # --- Job 1: Score Freelancer Reply with Coach ---
    coach_result = None
    if is_ollama:
        try:
            coach_prompt = format_coach_prompt(setup, reply)
            messages = [{"role": "user", "content": coach_prompt}]
            coach_result = call_ollama(messages, format_schema="json")
        except Exception:
            coach_result = None

    if not coach_result or "score" not in coach_result:
        coach_result = fallback_coach_scoring(setup, reply)

    # Normalize score structure
    scores = coach_result.get("score", {})
    feedback = coach_result.get("feedback", "Good effort.")
    suggested_reply = coach_result.get("suggested_reply", "")

    # --- Job 2: Generate Client Objection with Simulator ---
    client_result = None
    if is_ollama:
        try:
            client_prompt = format_client_prompt(setup, history + [{"speaker": "Freelancer", "text": reply}])
            messages = [{"role": "user", "content": client_prompt}]
            client_result = call_ollama(messages, format_schema="json")
        except Exception:
            client_result = None

    if not client_result or "client_message" not in client_result:
        client_result = fallback_client_turn(setup, round_num, reply)

    client_msg = client_result.get("client_message", "Could you provide more details?")
    pressure_tactic = client_result.get("pressure_tactic", "none")
    deal_status = client_result.get("deal_status", "ongoing")

    # Up to 5 rounds maximum
    is_complete = round_num >= 5 or deal_status in ["accepted", "walked away"]

    return NegotiationStepResponse(
        round_number=round_num,
        client_message=client_msg,
        pressure_tactic=pressure_tactic,
        deal_status=deal_status,
        score=scores,
        feedback=feedback,
        suggested_reply=suggested_reply,
        is_complete=is_complete
    )

@app.post("/api/negotiate/plan", response_model=FinalPlanResponse)
def generate_final_plan(req: FinalPlanRequest):
    """
    Produces the Final Negotiation Plan:
    - Recommended price
    - Boundaries in writing
    - Risks identified
    - Next action
    """
    setup = req.setup
    turns = req.turns

    # Compute score averages
    avg_scores = {
        "price_defence": 0.0,
        "scope_protection": 0.0,
        "professional_tone": 0.0,
        "overcommitment_risk": 0.0
    }
    valid_turns = 0
    for t in turns:
        s = t.get("score", {})
        if s:
            valid_turns += 1
            for k in avg_scores:
                avg_scores[k] += s.get(k, 0)
    if valid_turns > 0:
        for k in avg_scores:
            avg_scores[k] = round(avg_scores[k] / valid_turns, 1)

    ollama_status = get_ollama_status()
    if ollama_status["connected"]:
        try:
            plan_prompt = format_plan_prompt(setup, turns)
            messages = [{"role": "user", "content": plan_prompt}]
            plan_json = call_ollama(messages, format_schema="json")
            return FinalPlanResponse(
                recommended_price=float(plan_json.get("recommended_price", setup.quoted_price)),
                currency=setup.currency,
                boundaries_in_writing=plan_json.get("boundaries_in_writing", []),
                risks_identified=plan_json.get("risks_identified", []),
                next_action=plan_json.get("next_action", "Send a clear written proposal."),
                deal_summary=plan_json.get("deal_summary", "Negotiation rehearsal completed."),
                average_scores=avg_scores
            )
        except Exception:
            pass

    fallback_plan = fallback_final_plan(setup, turns)
    return FinalPlanResponse(
        recommended_price=float(fallback_plan["recommended_price"]),
        currency=fallback_plan["currency"],
        boundaries_in_writing=fallback_plan["boundaries_in_writing"],
        risks_identified=fallback_plan["risks_identified"],
        next_action=fallback_plan["next_action"],
        deal_summary=fallback_plan["deal_summary"],
        average_scores=avg_scores
    )

# Serve Frontend static assets if available
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

    @app.get("/")
    def serve_frontend():
        return FileResponse(frontend_dir / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
