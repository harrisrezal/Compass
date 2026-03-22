"""
scoring/normalise.py

Converts raw ingestion signals to a 0-100 normalised scale.

Each normaliser takes domain-specific raw values and returns a float 0-100.
normalise_all() aggregates across all signal types per ZIP code.

Called by the RocketRide normalise pipeline node:
    from scoring.normalise import normalise_all
    signals = normalise_all(grid_data, weather_data, alert_data)
"""

from __future__ import annotations

from typing import Optional


# ---------------------------------------------------------------------------
# Per-signal normalisers
# ---------------------------------------------------------------------------

def normalise_grid(stress_pct: Optional[float]) -> float:
    """
    Grid stress % → 0-100.
    Linear scale: 0% load = 0, 100% load = 100.
    CAISO typically issues Flex Alerts above ~90%.
    """
    if stress_pct is None:
        return 0.0
    return max(0.0, min(100.0, float(stress_pct)))


def normalise_heat(heat_index_f: Optional[float]) -> float:
    """
    Heat index °F → 0-100.
    <80°F   = 0   (safe)
    95°F    = 50  (Caution/Danger threshold for vulnerable people)
    115°F+  = 100 (Extreme Danger)
    """
    if heat_index_f is None:
        return 0.0
    t = float(heat_index_f)
    if t <= 80:
        return 0.0
    if t >= 115:
        return 100.0
    return round((t - 80) / (115 - 80) * 100, 1)


def normalise_wildfire(
    has_red_flag: bool = False,
    active_psps: bool = False,
    alert_types: Optional[list[str]] = None,
) -> float:
    """
    Wildfire/PSPS risk → 0-100.
    No flags        = 0
    Red Flag only   = 50
    PSPS active     = 75
    Both            = 100
    Evacuation      = 100
    """
    if alert_types is None:
        alert_types = []
    has_evacuation = any(a in ("evacuation_order", "evacuation_warning") for a in alert_types)
    if has_evacuation or (has_red_flag and active_psps):
        return 100.0
    if active_psps:
        return 75.0
    if has_red_flag:
        return 50.0
    return 0.0


def normalise_flood(fema_zone: Optional[str]) -> float:
    """
    FEMA flood zone designation → 0-100.
    Zone X  (minimal risk)   = 0
    Zone B/C                 = 20
    Zone A (100-yr floodplain) = 60
    Zone AE (detailed 100-yr) = 75
    Zone VE (coastal + wave)  = 100
    """
    if not fema_zone:
        return 0.0
    zone = fema_zone.upper().strip()
    if zone.startswith("VE"):
        return 100.0
    if zone.startswith("AE"):
        return 75.0
    if zone.startswith("AO") or zone.startswith("AH"):
        return 60.0
    if zone.startswith("A"):
        return 60.0
    if zone in ("B", "C"):
        return 20.0
    return 0.0  # Zone X and anything else


def normalise_history(outage_count: Optional[int], psps_count: Optional[int] = None) -> float:
    """
    Historical outage count → 0-100.
    Calibrated against the seed data range (Paradise ZIP = 8 outages, highest risk).
    0 outages = 0, 8+ outages = 80 (psps_count adds up to 20 more).
    """
    base = 0.0
    if outage_count:
        base = min(80.0, float(outage_count) / 8.0 * 80.0)
    psps_boost = 0.0
    if psps_count:
        psps_boost = min(20.0, float(psps_count) / 5.0 * 20.0)
    return round(min(100.0, base + psps_boost), 1)


# ---------------------------------------------------------------------------
# Aggregation across all ingestion signals per ZIP
# ---------------------------------------------------------------------------

def normalise_all(
    grid_data: list[dict],
    weather_data: list[dict],
    alert_data: list[dict],
) -> dict[str, dict[str, float]]:
    """
    Aggregate all signals into per-ZIP normalised component scores.

    Returns:
        {
            zip_code: {
                "grid":     0-100,
                "heat":     0-100,
                "wildfire": 0-100,
                "flood":    0-100,
                "history":  0-100,
                # raw values for writing to risk_scores table
                "_caiso_stress_pct":  float | None,
                "_temp_f":            float | None,
                "_heat_index_f":      float | None,
                "_has_red_flag":      bool,
                "_active_psps":       bool,
            }
        }
    """
    # --- Grid: take the maximum stress_pct across all forecast rows ---
    grid_max_stress: Optional[float] = None
    for row in grid_data:
        s = row.get("stress_pct")
        if s is not None:
            grid_max_stress = max(grid_max_stress or 0.0, float(s))
    flex_alert = any(row.get("flex_alert_active") for row in grid_data)

    # --- Weather: group by ZIP, take worst (highest heat index) ---
    weather_by_zip: dict[str, dict] = {}
    for row in weather_data:
        z = row.get("zip_code")
        if not z:
            continue
        hi = row.get("heat_index_f") or row.get("temp_f") or 0.0
        existing = weather_by_zip.get(z, {})
        if hi > existing.get("heat_index_f", 0):
            weather_by_zip[z] = row

    # --- Alerts: collect active alert types ---
    active_alert_types: list[str] = []
    for row in alert_data:
        if row.get("active"):
            at = row.get("alert_type")
            if at:
                active_alert_types.append(at)
    has_red_flag = "red_flag" in active_alert_types
    has_evacuation = any(a.startswith("evacuation") for a in active_alert_types)
    # PSPS is tracked via CAISO flex alert correlation (no direct API)
    active_psps = flex_alert and has_red_flag

    result: dict[str, dict[str, float]] = {}
    # Produce a signal dict for every ZIP we have weather data for
    for zip_code, w_row in weather_by_zip.items():
        hi = w_row.get("heat_index_f")
        tf = w_row.get("temp_f")

        result[zip_code] = {
            "grid":     normalise_grid(grid_max_stress),
            "heat":     normalise_heat(hi or tf),
            "wildfire": normalise_wildfire(has_red_flag, active_psps, active_alert_types),
            "flood":    0.0,  # filled in by composite.py using zip_flood_lookup.json
            "history":  0.0,  # filled in by composite.py using zip_outage_history.json
            # Raw values for transparency in risk_scores table
            "_caiso_stress_pct": grid_max_stress,
            "_temp_f":           float(tf) if tf is not None else None,
            "_heat_index_f":     float(hi) if hi is not None else None,
            "_has_red_flag":     has_red_flag,
            "_active_psps":      active_psps,
        }

    return result
