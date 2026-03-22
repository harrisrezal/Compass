"""api/routes/hazards.py — GET /hazards

Geocodes the user's address, fetches live hazard data in parallel,
scores each hazard independently, and generates Gemini alert messages
for any hazard rated MODERATE or higher.

Query parameters:
  address      str   Required. Full address or ZIP code.
  simulate     bool  Default false. Returns demo HIGH/CRITICAL data.
  medical      bool  Default false. User uses powered medical equipment.
  pets         bool  Default false. User has pets.
  age_group    str   Default "18-64". One of: under18 / 18-64 / 65+
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Query
from google.generativeai import GenerativeModel
import google.generativeai as genai

from api.models.hazard import HazardLevel, HazardResponse, MapData
from ingestion.hazard_clients import fetch_all_hazards
from scoring.hazard_scorer import score_all

router = APIRouter()

_HAZARD_LABELS = {
    "psps":       "Power Shutoff (PSPS)",
    "wildfire":   "Wildfire / Smoke",
    "flood":      "Flooding",
    "heat":       "Extreme Heat",
    "earthquake": "Earthquake",
}


# ── Geocoding ─────────────────────────────────────────────────────────────────

async def _geocode(address: str) -> tuple[float, float]:
    """Convert address string to (lat, lng) using Google Maps Geocoding API."""
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not api_key:
        # Fallback: hardcoded demo coordinates for Fresno CA
        return 36.7378, -119.7871

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(url, params={"address": address, "key": api_key})
        data = resp.json()
        if data.get("status") == "OK":
            loc = data["results"][0]["geometry"]["location"]
            return loc["lat"], loc["lng"]

    raise HTTPException(status_code=422, detail=f"Could not geocode address: {address}")


# ── Gemini alert generation ───────────────────────────────────────────────────

async def _generate_alert(
    address: str,
    hazard_key: str,
    level: HazardLevel,
    metrics: str,
    medical: bool,
    pets: bool,
    age_group: str,
) -> str:
    """Generate a ≤40 word alert message using Gemini."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return f"{level.value} {_HAZARD_LABELS[hazard_key]} alert at your address. Take immediate precautions."

    profile_parts = []
    if age_group == "65+":
        profile_parts.append("elderly resident")
    elif age_group == "under18":
        profile_parts.append("household with minors")
    if medical:
        profile_parts.append("uses powered medical equipment")
    if pets:
        profile_parts.append("has pets")
    profile_str = ", ".join(profile_parts) or "adult resident"

    prompt = (
        f"You are an emergency alert system. Generate a clear, calm, "
        f"2-sentence alert for a resident at {address}. "
        f"Hazard: {_HAZARD_LABELS[hazard_key]}. "
        f"Alert Level: {level.value}. "
        f"Key data: {metrics}. "
        f"User profile: {profile_str}. "
        f"Output: 1. What the threat is 2. What the user should do right now. "
        f"Keep it under 40 words total. No jargon."
    )

    try:
        genai.configure(api_key=api_key)
        model = GenerativeModel("gemini-2.5-flash")
        result = await asyncio.to_thread(model.generate_content, prompt)
        return result.text.strip()
    except Exception as e:
        return f"{level.value} {_HAZARD_LABELS[hazard_key]} alert at your address. Check local emergency services."


def _metrics_for(hazard_key: str, result_data: dict) -> str:
    """Extract a human-readable metrics string for the Gemini prompt."""
    if hazard_key == "psps":
        hrs = result_data.get("hours_to_shutoff")
        return f"Shutoff in {hrs}h, utility: {result_data.get('utility', 'unknown')}" if hrs else "Active shutoff"
    if hazard_key == "wildfire":
        return (
            f"Nearest fire {result_data.get('nearest_fire_km', '?')}km, "
            f"AQI {result_data.get('aqi', '?')}"
        )
    if hazard_key == "flood":
        return f"FEMA Zone {result_data.get('fema_zone', 'X')}, gauge {result_data.get('gauge_pct_above_flood_stage', 0)*100:.0f}% above flood stage"
    if hazard_key == "heat":
        return f"Heat index {result_data.get('heat_index_f', '?')}°F, overnight low {result_data.get('overnight_low_f', '?')}°F"
    if hazard_key == "earthquake":
        return f"M{result_data.get('max_magnitude', '?')} {result_data.get('nearest_quake_km', '?')}km away"
    return ""


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/hazards", response_model=HazardResponse)
async def get_hazards(
    address: str = Query(..., description="Full address or ZIP code"),
    simulate: bool = Query(False, description="Return demo HIGH/CRITICAL data"),
    medical: bool = Query(False, description="User uses powered medical equipment"),
    pets: bool = Query(False, description="User has pets"),
    age_group: str = Query("18-64", description="under18 / 18-64 / 65+"),
) -> HazardResponse:
    # 1. Geocode
    lat, lng = await _geocode(address)

    # 2. Fetch all hazard data in parallel
    raw_data = await fetch_all_hazards(lat, lng, simulate=simulate)

    # 3. Score all 5 hazards
    scored = score_all(raw_data)

    # 4. Generate Gemini alerts for MODERATE+ hazards in parallel
    async def maybe_generate(key: str, result):
        if result.level == HazardLevel.LOW:
            return key, None
        metrics = _metrics_for(key, result.data)
        msg = await _generate_alert(address, key, result.level, metrics, medical, pets, age_group)
        return key, msg

    alert_tasks = [maybe_generate(k, v) for k, v in scored.items()]
    alert_results = await asyncio.gather(*alert_tasks)

    for key, msg in alert_results:
        if msg:
            scored[key].alert_message = msg
            scored[key].alert_sent = True

    # 5. Build map data
    active_overlays = [k for k, v in scored.items() if v.level != HazardLevel.LOW]
    needs_evac_route = (
        scored["wildfire"].level == HazardLevel.CRITICAL or
        scored["flood"].level == HazardLevel.CRITICAL
    )

    map_data = MapData(
        user_lat_lng=[lat, lng],
        active_overlays=active_overlays,
        evacuation_route={"trigger": "wildfire_or_flood_critical"} if needs_evac_route else None,
        nearby_resources=[],  # populated by frontend via Places API
    )

    return HazardResponse(
        address=address,
        last_updated=datetime.now(timezone.utc).isoformat(),
        hazards={k: v for k, v in scored.items()},
        map_data=map_data,
    )
