---
title: "I Built DealGuard: A Local-First AI Negotiation Rehearsal Arena for Freelancers (Powered by Gemma 3 & Ollama)"
published: true
tags: ai, webdev, python, freelancing
cover_image: https://raw.githubusercontent.com/dealguard/dealguard/main/assets/banner.png
canonical_url: 
description: "Rehearse client negotiations, protect your floor rate, and stop scope creep before talking to real clients — 100% private and offline on your machine."
---

Every freelancer knows this feeling:

You get an inquiry on Upwork or email. The scope is massive: *"5 pages, bookings, payment gateways, and SEO."* 

Then you see their budget: **₹8,000**. And their deadline: **3 days**.

Under pressure, most developers make fatal negotiation mistakes:
1. They slash their price without cutting scope.
2. They agree to "unlimited revisions" or free hosting just to close the deal.
3. They end up working for less than minimum wage in revision purgatory.

To solve this, I built **DealGuard**: an open-source, local-first negotiation rehearsal tool powered by **Gemma 3** running locally through **Ollama**.

---

## 🎯 What is DealGuard?

**DealGuard** is a sparring partner for freelancers. Before you reply to a difficult client, you paste their message into DealGuard, set your terms (quoted rate, walk-away floor, deadline, non-negotiables), and role-play the negotiation with a persistent AI client.

After every counter-reply you send, DealGuard's AI Coach scores you on:
- 🛡️ **Price Defence (0–10)**: Did you hold your anchor quote or cave too quickly?
- 📐 **Scope Protection (0–10)**: Did you guard against feature creep and revision hell?
- 💼 **Professional Tone (0–10)**: Are you assertive, polite, and value-focused?
- ⚠️ **Overcommitment Risk (0–10)**: Did you make dangerous promises?

After 5 rounds (or when agreement is reached), DealGuard synthesizes a **Final Negotiation Playbook** complete with:
- A calculated **Anchor Rate**
- **Written Boundaries** to put in the contract
- **Traps & Risks Identified**
- A **copy-paste ready reply script** for the real client.

---

## 🛠️ The Architecture: The Two-AI Pipeline

A big mistake when building AI coaching tools is using one giant, convoluted prompt. If you ask a single LLM to simultaneously play the role of an adversarial client AND give objective coaching feedback, the output suffers from persona bleed and hallucinations.

DealGuard splits the AI workload into **two isolated calls** per turn:

```
[Freelancer Counter-Reply]
           │
           ├───► [AI Job 1: Negotiation Coach]
           │         └── Scores: price defence, scope protection, tone, overcommitment risk
           │
           └───► [AI Job 2: Client Simulator]
                     └── Generates next realistic objection (comparison, scope creep, urgency)
```

### 1. The Client Simulator Prompt
```text
You are simulating a realistic freelance client in a negotiation.
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
- Do not accept immediately unless the response is exceptionally strong.
- Keep it under 80 words.

Return JSON only:
{
  "client_message": "",
  "pressure_tactic": "price pressure | scope creep | urgency | comparison | vague scope | none",
  "deal_status": "ongoing | accepted | walked away"
}
```

### 2. The Negotiation Coach Prompt
```text
You are DealGuard, a negotiation coach for freelancers.
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
{
  "score": {
    "price_defence": 0,
    "scope_protection": 0,
    "professional_tone": 0,
    "overcommitment_risk": 0
  },
  "feedback": "",
  "suggested_reply": ""
}
```

By leveraging Ollama's structured output mode (`format: "json"`), both models return validated, deterministic JSON that the frontend can animate in real time.

---

## 🔒 100% Local-First & Private

Negotiations involve sensitive commercial data: client names, private emails, proprietary project descriptions, and your actual profit margins.

Sending this to third-party cloud APIs is a dealbreaker for many freelancers and agencies.

With **Gemma 3 + Ollama**:
- The inference runs entirely on your local GPU/CPU.
- Sessions are stored in browser `localStorage`.
- No remote telemetry.
- Zero API subscription fees.

---

## 🎬 The Walkthrough: A Real Rehearsal

Let's walk through the built-in demo scenario:

### 1. Setup
- **Client Inquiry**: *"Hi, I need a 5-page website with booking, payments, and SEO. My budget is ₹8,000. I need it in 3 days."*
- **Freelancer Quote**: `₹25,000`
- **Minimum Floor**: `₹18,000`
- **Deadline**: `7 business days`
- **Non-Negotiables**: `50% advance deposit`, `7-day turnaround`, `Strictly 2 revision rounds`.

### 2. Round 1: Comparison Pressure
- **Client**: *"Another developer on Upwork just quoted me ₹10,000 for this exact 5-page setup. Why is your price so much higher?"*
- **Freelancer**: *"My rate reflects production-grade code, secure payment gateway integrations, and comprehensive QA testing. If ₹8,000 is your absolute ceiling, we can do a 1-page landing page without payment integrations."*
- **DealGuard Coach**:
  - Price Defence: `9/10`
  - Scope Protection: `9/10`
  - Tone: `9/10`
  - Overcommitment Risk: `1/10`
  - *Feedback: "Excellent stance. You justified value without becoming defensive and offered to trade scope for price."*

### 3. Round 2: Scope Creep Attack
- **Client**: *"If I agree to your price, can you also bundle in free 1-year hosting and unlimited design revisions until I am 100% happy?"*
- **Freelancer (Testing a weak concession)**: *"Sure, I can accept that if we start today."*
- **DealGuard Coach (Alert!)**:
  - Overcommitment Risk: `9/10 (CRITICAL)`
  - Scope Protection: `2/10`
  - *Feedback: "Critical warning: You accepted scope creep (unlimited revisions/free addons). This creates immense risk of revision hell."*
  - *Suggested Counter: "I am happy to deliver the 5 core pages and payment integration. However, revisions are strictly limited to two rounds, and hosting is billed separately at cost."*

### 4. Final Playbook
At the end of the simulation, DealGuard generates the final plan:
- **Recommended Anchor Rate**: `₹22,000`
- **Boundaries in Writing**: 50% upfront deposit, 2 revision rounds cap, 7-day schedule.
- **Copy-Paste Client Script**: A polished, assertive response ready to paste back into your email or Upwork chat.

---

## 🚀 How to Run It in 2 Minutes

```bash
# 1. Pull the model in Ollama
ollama pull gemma3
ollama run gemma3

# 2. Clone the repo and start DealGuard
git clone https://github.com/Yamzxx/Voice-Project.git
cd Voice-Project
pip install -r dealguard/backend/requirements.txt
python run.py
```

Now open **`http://localhost:8000`** in your browser!

---

## 💡 What's Next?

- Voice input/output so you can practice verbal client phone calls.
- Custom client personalities (e.g. "The Micromanager", "The Startup Founder", "The Enterprise Procurement Officer").
- Exporting contracts directly with agreed boundary clauses.

Check out the code, star the repo, and stop leaving money on the table! 🛡️
