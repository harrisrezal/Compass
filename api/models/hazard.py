from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel


class HazardLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class HazardResult(BaseModel):
    level: HazardLevel
    label: str
    action: str
    alert_message: Optional[str] = None  # Gemini-generated; None when LOW
    alert_sent: bool = False
    acknowledged: bool = False
    call_dispatched: bool = False
    data: dict[str, Any] = {}


class MapData(BaseModel):
    user_lat_lng: list[float]
    active_overlays: list[str]  # hazard keys whose level > LOW
    evacuation_route: Optional[dict[str, Any]] = None
    nearby_resources: list[dict[str, Any]] = []


class HazardResponse(BaseModel):
    address: str
    last_updated: str
    hazards: dict[str, HazardResult]   # keys: psps / wildfire / flood / heat / earthquake
    map_data: MapData
