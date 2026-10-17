"""
Direct functional test for DealGuard backend logic.
"""
import sys
import io
from pathlib import Path

# Fix Windows cp1252 print encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Setup path
root_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(root_dir / "backend"))

from backend.schemas import DealSetup, NegotiationStepRequest, FinalPlanRequest
from backend.main import api_status, client_turn, coach_score, negotiate_step, generate_final_plan

def run_tests():
    print("1. Testing api_status()...")
    status = api_status()
    print("   Status:", status)
    assert status["status"] == "online"

    print("\n2. Testing client_turn()...")
    c_res = client_turn({
        "messages": [{"role": "user", "content": "What is your rate?"}],
        "format_schema": "json"
    })
    print("   Client turn response:", c_res)
    assert "client_message" in c_res
    assert "pressure_tactic" in c_res

    print("\n3. Testing coach_score() with high-risk concession...")
    setup_payload = {
        "client_message": "My budget is ₹8,000 in 3 days.",
        "service": "Website",
        "quoted_price": 25000,
        "minimum_price": 18000,
        "currency": "INR",
        "deadline": "7 days",
        "non_negotiables": ["50% advance", "Two rounds revisions"]
    }
    c_score = coach_score({
        "setup": setup_payload,
        "reply": "Sure, I can include free hosting and unlimited revisions."
    })
    print("   Coach scoring output:", c_score)
    assert c_score["score"]["overcommitment_risk"] >= 7, "Should flag unlimited revisions as high overcommitment risk"
    assert c_score["score"]["scope_protection"] <= 4, "Scope protection should be penalized for unlimited revisions"

    print("\n4. Testing negotiate_step()...")
    step_req = NegotiationStepRequest(
        setup=DealSetup(**setup_payload),
        reply="My rate is ₹22,000 with a 50% advance and 2 revision rounds strictly.",
        conversation_history=[],
        round_number=1
    )
    step_res = negotiate_step(step_req)
    print("   Negotiation step output:")
    print("   - Round:", step_res.round_number)
    print("   - Scores:", step_res.score)
    print("   - Coach feedback:", step_res.feedback)
    print("   - Client objection:", step_res.client_message)
    print("   - Tactic:", step_res.pressure_tactic)
    assert step_res.score["price_defence"] >= 7

    print("\n5. Testing generate_final_plan()...")
    plan_req = FinalPlanRequest(
        setup=DealSetup(**setup_payload),
        turns=[step_res.model_dump()]
    )
    plan_res = generate_final_plan(plan_req)
    print("   Final plan output:")
    print("   - Recommended price:", plan_res.recommended_price, plan_res.currency)
    print("   - Boundaries count:", len(plan_res.boundaries_in_writing))
    print("   - Risks count:", len(plan_res.risks_identified))
    print("   - Next action:", plan_res.next_action[:80] + "...")
    assert plan_res.recommended_price >= 18000

    print("\n==========================================")
    print("🎉 ALL DEALGUARD CORE LOGIC TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    run_tests()
