"""scoring/hazard_scorer.py

Five independent hazard scorers.
Each takes the raw dict from ingestion/hazard_clients.py and returns
a HazardResult with level, label, action, reasoning, data_sources, and raw data.

No composite score is produced. Each hazard stands alone.
"""

from __future__ import annotations

from api.models.hazard import HazardLevel, HazardResult


# ── PSPS ──────────────────────────────────────────────────────────────────────

def score_psps(raw: dict) -> HazardResult:
    in_active = raw.get("in_active_shutoff", False)
    in_warned = raw.get("in_warned_zone", False)
    hours = raw.get("hours_to_shutoff")
    in_watch = raw.get("in_watch_zone", False)
    utility = raw.get("utility") or "your utility"

    sources = ["CAISO OASIS", f"{utility} PSPS feed"]

    if in_active:
        return HazardResult(
            level=HazardLevel.CRITICAL,
            label=f"Active Power Shutoff — {utility}",
            action="Power is off now. Use battery backup. Call medical equipment supplier immediately.",
            reasoning=f"An active public safety power shutoff is confirmed in effect from {utility} for this address.",
            data_sources=sources,
            data=raw,
        )
    if in_warned and hours is not None and hours <= 6:
        return HazardResult(
            level=HazardLevel.HIGH,
            label=f"Power Shutoff Likely Within {round(hours, 1)} Hours — {utility}",
            action="Charge all devices now. Fill water containers. Locate medications.",
            reasoning=f"{utility} has issued a shutoff warning for this zone with approximately {round(hours, 1)} hours until the event begins.",
            data_sources=sources,
            data=raw,
        )
    if in_watch or (in_warned and (hours is None or hours > 6)):
        return HazardResult(
            level=HazardLevel.MODERATE,
            label=f"PSPS Watch Active — {utility}",
            action="Monitor alerts. Prepare battery packs. Identify cooling locations.",
            reasoning=f"This address is in a PSPS watch zone. {utility} is monitoring conditions that could trigger a shutoff.",
            data_sources=sources,
            data=raw,
        )
    return HazardResult(
        level=HazardLevel.LOW,
        label="No Power Shutoff Threat",
        action="No action needed.",
        reasoning=f"No active shutoff zones, warnings, or watches from {utility} for this address.",
        data_sources=sources,
        data=raw,
    )


# ── WILDFIRE ──────────────────────────────────────────────────────────────────

def score_wildfire(raw: dict) -> HazardResult:
    evac_order = raw.get("evacuation_order", False)
    evac_warning = raw.get("evacuation_warning", False)
    nearest_km = raw.get("nearest_fire_km", 999.0)
    red_flag = raw.get("red_flag_warning", False)
    aqi = raw.get("aqi", 0)
    fire_name = raw.get("fire_name")

    fire_label = f" ({fire_name})" if fire_name else ""
    sources = ["NASA FIRMS hotspot data", "NWS Alerts", "CAL FIRE", "AirNow AQI"]

    if evac_order:
        return HazardResult(
            level=HazardLevel.CRITICAL,
            label=f"Evacuation ORDER Active{fire_label}",
            action="Leave immediately. Take medications, documents, pets. Do not return.",
            reasoning=f"A mandatory evacuation order has been issued for this area{fire_label} by CAL FIRE / local authorities.",
            data_sources=sources,
            data=raw,
        )
    if evac_warning or nearest_km <= 5.0:
        label = f"Evacuation Warning — Fire {round(nearest_km, 1)}km Away{fire_label}"
        return HazardResult(
            level=HazardLevel.HIGH,
            label=label,
            action="Be ready to leave in 15 minutes. Pack go-bag. Fill car with gas.",
            reasoning=f"An active fire{fire_label} is {round(nearest_km, 1)}km from this address. An evacuation warning is in effect.",
            data_sources=sources,
            data=raw,
        )
    if (red_flag and nearest_km <= 20.0) or aqi > 150:
        label = (
            f"Red Flag Warning — Fire {round(nearest_km, 1)}km Away"
            if nearest_km < 999
            else f"Poor Air Quality (AQI {aqi})"
        )
        reasoning = (
            f"NWS Red Flag Warning active with a fire {round(nearest_km, 1)}km away."
            if nearest_km < 999
            else f"Air quality index is {aqi} (Unhealthy) — hazardous for sensitive groups."
        )
        return HazardResult(
            level=HazardLevel.MODERATE,
            label=label,
            action="Stay indoors. Close windows. Wear N95 mask if going outside.",
            reasoning=reasoning,
            data_sources=sources,
            data=raw,
        )
    return HazardResult(
        level=HazardLevel.LOW,
        label="No Active Wildfire Threat",
        action="No action needed.",
        reasoning=f"No active fires within 50km, no evacuation orders or warnings, no Red Flag Warning. AQI: {aqi}.",
        data_sources=sources,
        data=raw,
    )


# ── FLOOD ─────────────────────────────────────────────────────────────────────

def score_flood(raw: dict) -> HazardResult:
    ffe = raw.get("flash_flood_emergency", False)
    warning = raw.get("flood_warning", False)
    watch = raw.get("flood_watch", False)
    fema_zone = raw.get("fema_zone", "X")
    gauge_pct = raw.get("gauge_pct_above_flood_stage", 0.0)

    high_risk_zone = fema_zone.startswith(("A", "V"))
    sources = ["NWS Alerts", "USGS stream gauges", f"FEMA flood zone {fema_zone}"]

    if ffe:
        return HazardResult(
            level=HazardLevel.CRITICAL,
            label="Flash Flood Emergency at Your Location",
            action="Move to highest floor now. Do NOT drive through water. Call 911 if trapped.",
            reasoning="A flash flood emergency has been declared — life-threatening flooding is imminent or occurring at this location.",
            data_sources=sources,
            data=raw,
        )
    if warning and high_risk_zone:
        return HazardResult(
            level=HazardLevel.HIGH,
            label=f"Flood Warning — FEMA Zone {fema_zone}",
            action="Move valuables upstairs. Be ready to evacuate. Avoid low-lying roads.",
            reasoning=f"A flood warning is active and this address is in FEMA high-risk flood zone {fema_zone}, indicating elevated inundation risk.",
            data_sources=sources,
            data=raw,
        )
    if watch or (gauge_pct > 0.3):
        label = "Flood Watch Active" if watch else f"River Rising — {round(gauge_pct * 100, 0):.0f}% Above Flood Stage"
        reasoning = (
            "NWS has issued a flood watch — conditions are favourable for flooding in the coming hours."
            if watch
            else f"Nearby USGS stream gauge is {round(gauge_pct * 100, 0):.0f}% above flood stage, indicating rising flood risk."
        )
        return HazardResult(
            level=HazardLevel.MODERATE,
            label=label,
            action="Monitor local alerts. Avoid flood-prone areas. Keep sandbags on hand.",
            reasoning=reasoning,
            data_sources=sources,
            data=raw,
        )
    return HazardResult(
        level=HazardLevel.LOW,
        label="No Active Flood Threat",
        action="No action needed.",
        reasoning=f"No flood warnings or watches active. FEMA Zone {fema_zone}. Stream gauges are within normal range.",
        data_sources=sources,
        data=raw,
    )


# ── HEAT ──────────────────────────────────────────────────────────────────────

def score_heat(raw: dict) -> HazardResult:
    ehw = raw.get("excessive_heat_warning", False)
    ha = raw.get("heat_advisory", False)
    heat_index = raw.get("heat_index_f", 0.0)
    overnight_low = raw.get("overnight_low_f", 0.0)

    sources = ["NWS Alerts", "OpenWeatherMap"]

    if ehw and overnight_low > 75.0:
        return HazardResult(
            level=HazardLevel.CRITICAL,
            label=f"Extreme Heat — No Overnight Recovery (Low {round(overnight_low, 0):.0f}°F)",
            action="Stay in air conditioning. Check on elderly neighbors. Call 911 for heat stroke.",
            reasoning=f"Excessive heat warning is active with a heat index of {round(heat_index, 0):.0f}°F and no overnight relief — low of {round(overnight_low, 0):.0f}°F. Dangerous for vulnerable individuals.",
            data_sources=sources,
            data=raw,
        )
    if ehw:
        return HazardResult(
            level=HazardLevel.HIGH,
            label=f"Excessive Heat Warning — Heat Index {round(heat_index, 0):.0f}°F",
            action="Stay indoors during peak hours (10am–6pm). Drink water every 30 minutes.",
            reasoning=f"NWS has issued an excessive heat warning. Current heat index is {round(heat_index, 0):.0f}°F with overnight low of {round(overnight_low, 0):.0f}°F.",
            data_sources=sources,
            data=raw,
        )
    if ha:
        return HazardResult(
            level=HazardLevel.MODERATE,
            label="Heat Advisory in Effect",
            action="Limit outdoor activity. Stay hydrated. Locate nearest cooling center.",
            reasoning=f"NWS heat advisory active — heat index reaching {round(heat_index, 0):.0f}°F. Uncomfortable but manageable with precautions.",
            data_sources=sources,
            data=raw,
        )
    return HazardResult(
        level=HazardLevel.LOW,
        label="No Heat Advisory",
        action="No action needed.",
        reasoning=f"No heat warnings or advisories active. Heat index: {round(heat_index, 0):.0f}°F, overnight low: {round(overnight_low, 0):.0f}°F.",
        data_sources=sources,
        data=raw,
    )


# ── EARTHQUAKE ────────────────────────────────────────────────────────────────

def score_earthquake(raw: dict) -> HazardResult:
    mag = raw.get("max_magnitude", 0.0)
    dist_km = raw.get("nearest_quake_km", 999.0)
    hours_ago = raw.get("hours_ago", 999.0)
    on_liq = raw.get("on_liquefaction_zone", False)

    sources = ["USGS FDSN earthquake catalog", "CGSHM liquefaction zone maps"]

    if mag >= 5.5 and dist_km <= 20.0 and hours_ago <= 2.0:
        return HazardResult(
            level=HazardLevel.CRITICAL,
            label=f"M{mag} Earthquake {round(dist_km, 0):.0f}km Away ({round(hours_ago, 1)}h ago)",
            action="Check for gas leaks. Stay away from damaged structures. Expect aftershocks.",
            reasoning=f"USGS recorded a M{mag} earthquake {round(dist_km, 0):.0f}km from this address {round(hours_ago, 1)} hours ago. Aftershocks are likely.",
            data_sources=sources,
            data=raw,
        )
    if 4.0 <= mag < 5.5 and dist_km <= 20.0 and hours_ago <= 2.0:
        return HazardResult(
            level=HazardLevel.HIGH,
            label=f"M{mag} Earthquake {round(dist_km, 0):.0f}km Away",
            action="Inspect home for damage. Secure heavy furniture. Keep shoes nearby.",
            reasoning=f"USGS recorded a M{mag} earthquake {round(dist_km, 0):.0f}km from this address {round(hours_ago, 1)} hours ago.",
            data_sources=sources,
            data=raw,
        )
    if (2.5 <= mag < 4.0 and dist_km <= 50.0) or on_liq:
        label = (
            f"M{mag} Activity Nearby — Liquefaction Risk Zone"
            if on_liq
            else f"M{mag} Activity Within 50km"
        )
        reasoning = (
            f"This address is in a CGSHM liquefaction risk zone. Recent M{mag} activity {round(dist_km, 0):.0f}km away increases soil instability risk."
            if on_liq
            else f"USGS detected M{mag} seismic activity within 50km in the past 24 hours."
        )
        return HazardResult(
            level=HazardLevel.MODERATE,
            label=label,
            action="Review earthquake kit. Know your evacuation route. Monitor USGS updates.",
            reasoning=reasoning,
            data_sources=sources,
            data=raw,
        )
    return HazardResult(
        level=HazardLevel.LOW,
        label="No Significant Seismic Activity",
        action="No action needed.",
        reasoning=f"No earthquakes M2.5+ detected within 50km in the past 24 hours. Nearest recent event: M{mag} at {round(dist_km, 0):.0f}km.",
        data_sources=sources,
        data=raw,
    )


# ── Score all ─────────────────────────────────────────────────────────────────

def score_all(raw_data: dict) -> dict[str, HazardResult]:
    """
    Score all 5 hazards from the raw data dict returned by fetch_all_hazards().
    Returns a dict keyed by hazard name.
    """
    return {
        "psps":       score_psps(raw_data.get("psps", {})),
        "wildfire":   score_wildfire(raw_data.get("wildfire", {})),
        "flood":      score_flood(raw_data.get("flood", {})),
        "heat":       score_heat(raw_data.get("heat", {})),
        "earthquake": score_earthquake(raw_data.get("earthquake", {})),
    }
