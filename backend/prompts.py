"""
Prompt templates for DealGuard.
Keeps Client Simulation, Coach Evaluation, and Final Plan generation separated and modular.
"""

CLIENT_SIMULATOR_PROMPT_TEMPLATE = """You are simulating a realistic freelance client in a negotiation.
Client's original message: {client_message}
Freelancer's service: {service}
Freelancer's quoted price: {quoted_price} {currency}
Freelancer's minimum acceptable price: {minimum_price} {currency}
Deadline: {deadline}
Freelancer's non-negotiables: {non_negotiables}
Conversation so far: {conversation}

Generate the client's next message.
Rules:
- Be realistic, polite but persistent.
- Use one pressure tactic at a time.
- Do not invent facts about the project.
- Do not accept immediately unless the freelancer's response is exceptionally strong.
- Keep it under 80 words.

Return JSON only:
{{
  "client_message": "",
  "pressure_tactic": "price pressure | scope creep | urgency | comparison | vague scope | none",
  "deal_status": "ongoing | accepted | walked away"
}}"""

COACH_PROMPT_TEMPLATE = """You are DealGuard, a negotiation coach for freelancers.
Freelancer's minimum acceptable price: {minimum_price} {currency}
Freelancer's non-negotiables: {non_negotiables}
Freelancer's latest reply: {reply}

Score the reply from 0 to 10 on:
- price_defence
- scope_protection
- professional_tone
- overcommitment_risk, where 10 means very high risk

Then give one specific improvement.

Return JSON only:
{{
  "score": {{
    "price_defence": 0,
    "scope_protection": 0,
    "professional_tone": 0,
    "overcommitment_risk": 0
  }},
  "feedback": "",
  "suggested_reply": ""
}}"""

PLAN_PROMPT_TEMPLATE = """You are DealGuard, an expert freelance negotiation strategist.
Analyze the complete simulation session below:
Service: {service}
Initial Quote: {quoted_price} {currency}
Floor/Minimum Rate: {minimum_price} {currency}
Required Deadline: {deadline}
Non-negotiable Clauses: {non_negotiables}
Negotiation History:
{conversation}

Synthesize a comprehensive, tactical Negotiation Plan before the freelancer sends their real reply to the client.
Return JSON only:
{{
  "recommended_price": {quoted_price},
  "currency": "{currency}",
  "boundaries_in_writing": [
    "Strict boundary 1 to explicitly include in contract or message",
    "Strict boundary 2"
  ],
  "risks_identified": [
    "Specific risk observed during rehearsal (e.g. scope bleed, budget anchoring)",
    "Secondary risk"
  ],
  "next_action": "Exact tactical wording or script to send to the client right now",
  "deal_summary": "1-2 sentence assessment of negotiation leverage and stance"
}}"""

def format_client_prompt(setup, conversation_history) -> str:
    conv_text = ""
    for item in conversation_history:
        speaker = item.get("speaker", item.get("role", "Party"))
        text = item.get("text", item.get("content", ""))
        conv_text += f"\n- {speaker}: {text}"
    if not conv_text.strip():
        conv_text = "No prior messages yet."
        
    non_negs = ", ".join(setup.non_negotiables) if setup.non_negotiables else "None provided"

    return CLIENT_SIMULATOR_PROMPT_TEMPLATE.format(
        client_message=setup.client_message,
        service=setup.service,
        quoted_price=setup.quoted_price,
        minimum_price=setup.minimum_price,
        currency=setup.currency,
        deadline=setup.deadline,
        non_negotiables=non_negs,
        conversation=conv_text
    )

def format_coach_prompt(setup, reply: str) -> str:
    non_negs = ", ".join(setup.non_negotiables) if setup.non_negotiables else "None provided"
    return COACH_PROMPT_TEMPLATE.format(
        minimum_price=setup.minimum_price,
        currency=setup.currency,
        non_negotiables=non_negs,
        reply=reply
    )

def format_plan_prompt(setup, turns: list) -> str:
    conv_text = ""
    for turn in turns:
        c_msg = turn.get("client_message", "")
        f_msg = turn.get("freelancer_reply", "")
        tactic = turn.get("pressure_tactic", "none")
        score = turn.get("score", {})
        if c_msg:
            conv_text += f"\nClient ({tactic}): {c_msg}"
        if f_msg:
            conv_text += f"\nFreelancer: {f_msg} [Scores: {score}]"
            
    non_negs = ", ".join(setup.non_negotiables) if setup.non_negotiables else "None provided"

    return PLAN_PROMPT_TEMPLATE.format(
        service=setup.service,
        quoted_price=setup.quoted_price,
        minimum_price=setup.minimum_price,
        currency=setup.currency,
        deadline=setup.deadline,
        non_negotiables=non_negs,
        conversation=conv_text or "No turns recorded."
    )
