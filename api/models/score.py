from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    ELEVATED = "ELEVATED"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class PrimaryThreat(str, Enum):
    GRID = "grid"
    HEAT = "heat"
    WILDFIRE = "wildfire"
    FLOOD = "flood"
    NONE = "none"


class RiskScore(BaseModel):
    score_id: str
    user_id: str
    timestamp: datetime
    forecast_window_hrs: Optional[int] = 72
    composite_score: float = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    primary_threat: Optional[PrimaryThreat] = None
    hours_to_action: Optional[int] = None

    # Component scores (0-100)
    grid_stress_score: Optional[float] = Field(None, ge=0, le=100)
    heat_index_score: Optional[float] = Field(None, ge=0, le=100)
    wildfire_psps_score: Optional[float] = Field(None, ge=0, le=100)
    flood_risk_score: Optional[float] = Field(None, ge=0, le=100)
    historical_risk_score: Optional[float] = Field(None, ge=0, le=100)

    # Raw inputs
    caiso_stress_pct: Optional[float] = None
    temp_forecast_f: Optional[float] = None
    heat_index_f: Optional[float] = None
    has_red_flag_warning: Optional[bool] = None
    active_psps: Optional[bool] = None
    fema_flood_zone: Optional[str] = None
    historical_outage_count: Optional[int] = None

    persona_multiplier: Optional[float] = None
    vertex_ai_prediction: Optional[float] = Field(None, ge=0, le=1)
    alert_triggered: Optional[bool] = None
