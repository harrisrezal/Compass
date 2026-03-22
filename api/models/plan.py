from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Urgency(str, Enum):
    NOW = "NOW"
    TODAY = "TODAY"
    BEFORE_EVENT = "BEFORE_EVENT"
    DURING = "DURING"
    AFTER = "AFTER"


class ActionItem(BaseModel):
    order: Optional[int] = None
    urgency: Optional[Urgency] = None
    action: Optional[str] = None
    detail: Optional[str] = None
    completed: Optional[bool] = False


class ActionPlan(BaseModel):
    plan_id: str
    user_id: str
    score_id: Optional[str] = None
    generated_at: datetime
    risk_level: Optional[str] = None
    primary_threat: Optional[str] = None
    action_items: list[ActionItem] = Field(default_factory=list)
    gemini_raw_output: Optional[str] = None
    language: Optional[str] = "en"
    caregiver_notified: Optional[bool] = None
