from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class TriggerReason(str, Enum):
    SCORE_THRESHOLD = "score_threshold"
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    NO_RESPONSE = "no_response"


class CallOutcome(str, Enum):
    SAFE = "safe"
    NEEDS_HELP = "needs_help"
    NO_ANSWER = "no_answer"
    ESCALATED = "escalated"


class WelfareCheck(BaseModel):
    check_id: str
    user_id: str
    triggered_at: datetime
    trigger_reason: Optional[TriggerReason] = None
    push_sent_at: Optional[datetime] = None
    push_acknowledged: Optional[bool] = None
    sms_sent_at: Optional[datetime] = None
    sms_response: Optional[str] = None
    call_initiated_at: Optional[datetime] = None
    call_answered: Optional[bool] = None
    call_outcome: Optional[CallOutcome] = None
    ai_transcript: Optional[str] = None
    caregiver_alerted: Optional[bool] = None
    resolved: Optional[bool] = None


class WelfareCheckCreate(BaseModel):
    """Request body for POST /welfare/check."""
    user_id: str
    trigger_reason: TriggerReason = TriggerReason.MANUAL
