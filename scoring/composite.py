"""
scoring/composite.py

Weighted composite risk scoring engine.

Reads normalised signals per ZIP, fetches user profiles from BigQuery,
applies persona multipliers and backup power modifiers, and produces a
risk_score row for each enrolled user.

Called by the RocketRide score-engine and alert-check pipeline nodes:
    from scoring.composite import calculate_all_user_scores, check_and_trigger_alerts
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from google.cloud import bigquery

from scoring.weights import (
    WEIGHTS,
    CONDITION_MULTIPLIERS,
    BACKUP_NO_POWER_BOOST,
    BACKUP_MINIMAL_BOOST,
    BACKUP_STRONG_REDUCTION,
    BACKUP_THRESHOLD_MINIMAL,
    BACKUP_THRESHOLD_STRONG,
    RISK_LEVELS,
    ALERT_THRESHOLD,
    ESCALATION_THRESHOLD,
    CRITICAL_THRESHOLD,
)
from scoring.normalise import normalise_flood, normalise_history

_PROJECT = os.getenv("GCP_PROJECT_ID")
_DATASET = os.getenv("BQ_DATASET", "vitaguard")

# Reference data paths
_DATA_DIR = Path(__file__).parent.parent / "files"
_FLOOD_LOOKUP: dict[str, str] = {}
_HISTORY_LOOKUP: dict[str, dict] = {}
_HFTD_LOOKUP: dict[str, str] = {}


def _load_lookups() -> None:
    global _FLOOD_LOOKUP, _HISTORY_LOOKUP, _HFTD_LOOKUP
    if _FLOOD_LOOKUP:
        return  # already loaded
    with open(_DATA_DIR / "zip_flood_lookup.json") as f:
        _FLOOD_LOOKUP = json.load(f)["lookup"]
    with open(_DATA_DIR / "zip_outage_history.json") as f:
        _HISTORY_LOOKUP = json.load(f)["lookup"]
    with open(_DATA_DIR / "zip_hftd_lookup.json") as f:
        _HFTD_LOOKUP = json.load(f)["lookup"]


def _bq_client() -> bigquery.Client:
    if not _PROJECT:
        raise EnvironmentError("GCP_PROJECT_ID is not set")
    return bigquery.Client(project=_PROJECT)


def _fetch_all_users() -> list[dict]:
    """Load all user profiles from vitaguard.user_profiles."""
    client = _bq_client()
    query = f"SELECT * FROM `{_PROJECT}.{_DATASET}.user_profiles`"
    return [dict(row) for row in client.query(query).result()]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _risk_level(score: float) -> str:
    for threshold, level in RISK_LEVELS:
        if score >= threshold:
            return level
    return "LOW"


def _primary_threat(components: dict[str, float]) -> str:
    """Return the signal name with the highest weighted contribution."""
    weighted = {k: components.get(k, 0.0) * WEIGHTS[k] for k in WEIGHTS}
    best = max(weighted, key=lambda k: weighted[k])
    return best if weighted[best] > 0 else "none"


def _backup_modifier(user: dict) -> float:
    equipment = user.get("equipment") or {}
    backup_hours = equipment.get("backup_hours")
    if backup_hours is None or backup_hours <= BACKUP_THRESHOLD_MINIMAL:
        if backup_hours == 0 or backup_hours is None:
            return BACKUP_NO_POWER_BOOST
        return BACKUP_MINIMAL_BOOST
    if backup_hours >= BACKUP_THRESHOLD_STRONG:
        return BACKUP_STRONG_REDUCTION
    return 1.0


def calculate_score(user: dict, signals: dict[str, dict]) -> dict:
    """
    Calculate a risk score for a single user given normalised signals.

    Args:
        user:    Row from vitaguard.user_profiles
        signals: Output of normalise_all() — {zip_code: {grid, heat, wildfire, ...}}

    Returns:
        Dict shaped for vitaguard.risk_scores table.
    """
    _load_lookups()
    zip_code = user.get("zip_code", "")
    zip_signals = signals.get(zip_code, {})

    # Fill flood + history from lookup tables (not available from weather/grid APIs)
    fema_zone = _FLOOD_LOOKUP.get(zip_code, "X")
    history = _HISTORY_LOOKUP.get(zip_code, {})
    flood_score = normalise_flood(fema_zone)
    history_score = normalise_history(
        history.get("outage_count"), history.get("psps_count")
    )

    components = {
        "grid":     zip_signals.get("grid", 0.0),
        "heat":     zip_signals.get("heat", 0.0),
        "wildfire": zip_signals.get("wildfire", 0.0),
        "flood":    flood_score,
        "history":  history_score,
    }

    # Weighted base score
    base_score = sum(components[k] * WEIGHTS[k] for k in WEIGHTS)

    # Persona multiplier
    condition = user.get("condition") or "other"
    multiplier = CONDITION_MULTIPLIERS.get(condition, 1.0)

    # Backup power modifier
    backup_mod = _backup_modifier(user)

    composite = min(100.0, round(base_score * multiplier * backup_mod, 1))
    risk_lvl = _risk_level(composite)
    threat = _primary_threat(components)

    # Estimate hours_to_action based on condition
    hours_map = {
        "ventilator":     0,
        "oxygen":         4,
        "heat_vulnerable": 6,
        "wheelchair":     8,
        "dialysis":       48,
        "other":          24,
    }
    hours_to_action = hours_map.get(condition, 24)

    raw = zip_signals  # already contains _caiso_stress_pct, _heat_index_f, etc.

    return {
        "score_id": str(uuid.uuid4()),
        "user_id": user.get("user_id", ""),
        "timestamp": _utc_now(),
        "forecast_window_hrs": 72,
        "composite_score": composite,
        "risk_level": risk_lvl,
        "primary_threat": threat,
        "hours_to_action": hours_to_action,
        # Component scores
        "grid_stress_score": components["grid"],
        "heat_index_score": components["heat"],
        "wildfire_psps_score": components["wildfire"],
        "flood_risk_score": components["flood"],
        "historical_risk_score": components["history"],
        # Raw inputs
        "caiso_stress_pct": raw.get("_caiso_stress_pct"),
        "temp_forecast_f": raw.get("_temp_f"),
        "heat_index_f": raw.get("_heat_index_f"),
        "has_red_flag_warning": raw.get("_has_red_flag", False),
        "active_psps": raw.get("_active_psps", False),
        "fema_flood_zone": fema_zone,
        "historical_outage_count": history.get("outage_count"),
        # Modifiers
        "persona_multiplier": round(multiplier * backup_mod, 3),
        "vertex_ai_prediction": None,  # filled in by vertex_client.py when available
        "alert_triggered": composite >= ALERT_THRESHOLD,
    }


def calculate_all_user_scores(normalised_signals: dict[str, dict]) -> list[dict]:
    """
    Calculate risk scores for every enrolled user.
    Called by the RocketRide score-engine pipeline node.

    Args:
        normalised_signals: Output of normalise_all()

    Returns:
        List of risk_score rows ready for BigQuery insert.
    """
    users = _fetch_all_users()
    scores = [calculate_score(user, normalised_signals) for user in users]
    print(f"[composite] Scored {len(scores)} users")
    for s in scores:
        print(f"  {s['user_id']}: {s['composite_score']} ({s['risk_level']})")
    return scores


def check_and_trigger_alerts(
    risk_scores: list[dict],
    alert_threshold: int = ALERT_THRESHOLD,
    escalation_threshold: int = ESCALATION_THRESHOLD,
    critical_threshold: int = CRITICAL_THRESHOLD,
) -> list[dict]:
    """
    Filter risk_scores by threshold and return those that should trigger alerts.
    The RocketRide alert-check node uses the return value to kick off the
    advisory pipeline for each flagged user.

    Returns:
        List of risk_score dicts where composite_score >= alert_threshold.
    """
    triggered = [s for s in risk_scores if s.get("composite_score", 0) >= alert_threshold]
    if triggered:
        print(f"[composite] {len(triggered)} user(s) above alert threshold ({alert_threshold}):")
        for s in triggered:
            level = s["risk_level"]
            score = s["composite_score"]
            uid = s["user_id"]
            tier = (
                "CRITICAL" if score >= critical_threshold
                else "ESCALATION" if score >= escalation_threshold
                else "ALERT"
            )
            print(f"  {uid}: {score} ({level}) → {tier}")
    return triggered
