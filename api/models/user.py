from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Utility(str, Enum):
    PGE = "PGE"
    SCE = "SCE"
    SDGE = "SDGE"
    OTHER = "OTHER"


class Condition(str, Enum):
    OXYGEN = "oxygen"
    DIALYSIS = "dialysis"
    WHEELCHAIR = "wheelchair"
    VENTILATOR = "ventilator"
    HEAT_VULNERABLE = "heat_vulnerable"
    INSULIN_DEPENDENT = "insulin_dependent"
    OTHER = "other"


class NotifyThreshold(str, Enum):
    ELEVATED = "ELEVATED"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Equipment(BaseModel):
    type: Optional[str] = None
    power_watts: Optional[int] = None
    backup_hours: Optional[float] = None
    supplier_name: Optional[str] = None
    supplier_phone: Optional[str] = None


class Medication(BaseModel):
    name: Optional[str] = None
    requires_refrigeration: Optional[bool] = None
    heat_sensitive: Optional[bool] = None
    beta_blocker: Optional[bool] = None


class Caregiver(BaseModel):
    name: Optional[str] = None
    relationship: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notify_threshold: Optional[NotifyThreshold] = None


class NearestResources(BaseModel):
    hospital_name: Optional[str] = None
    hospital_miles: Optional[float] = None
    cooling_center: Optional[str] = None
    pharmacy_name: Optional[str] = None


class UserProfile(BaseModel):
    user_id: str
    name: str
    age: Optional[int] = None
    zip_code: str
    utility: Optional[Utility] = None
    medical_baseline_enrolled: Optional[bool] = None
    condition: Optional[Condition] = None
    equipment: Optional[Equipment] = None
    medications: list[Medication] = Field(default_factory=list)
    can_self_evacuate: Optional[bool] = None
    preferred_language: Optional[str] = "en"
    caregiver: Optional[Caregiver] = None
    nearest_resources: Optional[NearestResources] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserProfileCreate(BaseModel):
    """Request body for POST /users — user_id auto-generated server-side."""
    name: str
    age: Optional[int] = None
    zip_code: str
    utility: Optional[Utility] = None
    medical_baseline_enrolled: Optional[bool] = None
    condition: Optional[Condition] = None
    equipment: Optional[Equipment] = None
    medications: list[Medication] = Field(default_factory=list)
    can_self_evacuate: Optional[bool] = None
    preferred_language: Optional[str] = "en"
    caregiver: Optional[Caregiver] = None
    nearest_resources: Optional[NearestResources] = None
