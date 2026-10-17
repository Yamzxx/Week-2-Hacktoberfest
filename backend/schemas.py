from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class DealSetup(BaseModel):
    client_message: str = Field(..., description="Client's initial message or inquiry")
    service: str = Field(..., description="Freelancer's service offering")
    quoted_price: float = Field(..., description="Freelancer's initial quote")
    minimum_price: float = Field(..., description="Freelancer's walk-away floor price")
    currency: str = Field(default="INR", description="Currency symbol/code")
    deadline: str = Field(..., description="Freelancer's required timeline/deadline")
    non_negotiables: list[str] = Field(default=[], description="Strict non-negotiable clauses")

class FreelancerReply(BaseModel):
    reply: str = Field(..., description="Freelancer's counter or response")

class ScoreBreakdown(BaseModel):
    price_defence: int = Field(default=0, ge=0, le=10)
    scope_protection: int = Field(default=0, ge=0, le=10)
    professional_tone: int = Field(default=0, ge=0, le=10)
    overcommitment_risk: int = Field(default=0, ge=0, le=10)

class ClientTurn(BaseModel):
    client_message: str
    pressure_tactic: str
    score: dict
    feedback: str
    deal_status: str

class ChatMessage(BaseModel):
    role: str # "user", "assistant", or "client"
    content: str
    tactic: Optional[str] = None
    scores: Optional[Dict[str, int]] = None
    feedback: Optional[str] = None
    suggested_reply: Optional[str] = None

class NegotiationStepRequest(BaseModel):
    setup: DealSetup
    reply: str
    conversation_history: List[Dict[str, Any]] = []
    round_number: int = 1

class NegotiationStepResponse(BaseModel):
    round_number: int
    client_message: str
    pressure_tactic: str
    deal_status: str # "ongoing", "accepted", "walked away"
    score: Dict[str, int]
    feedback: str
    suggested_reply: str
    is_complete: bool = False

class FinalPlanRequest(BaseModel):
    setup: DealSetup
    turns: List[Dict[str, Any]]

class FinalPlanResponse(BaseModel):
    recommended_price: float
    currency: str
    boundaries_in_writing: List[str]
    risks_identified: List[str]
    next_action: str
    deal_summary: str
    average_scores: Dict[str, float]
