"""
scoring/advisory.py

Gemini Pro action plan generation.

Fetches user profile + risk score, calls Gemini to generate a
condition-specific ranked action checklist, parses the output,
and writes the plan to vitaguard.action_plans.

Functions match the advisory_pipeline.json node definitions:
  fetch_user_profile(user_id)
  fetch_latest_score(user_id)
  get_equipment_specs(user_profile)
  generate_action_plan(user_profile, risk_score, equipment_specs)
  store_action_plan(action_plan)
  send_notifications(user_profile, risk_score, action_plan)

Usage:
    import asyncio
    from scoring.advisory import run_advisory_for_user
    plan = asyncio.run(run_advisory_for_user("demo-user-margaret-001"))
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import google.generativeai as genai
from google.cloud import bigquery

_PROJECT = os.getenv("GCP_PROJECT_ID")
_DATASET = os.getenv("BQ_DATASET", "vitaguard")
_GEMINI_MODEL = "gemini-1.5-pro"

_EQUIPMENT_DB_PATH = Path(__file__).parent.parent / "files" / "equipment_db.json"
_EQUIPMENT_DB: list[dict] = []


def _bq() -> bigquery.Client:
    return bigquery.Client(project=_PROJECT)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_equipment_db() -> list[dict]:
    global _EQUIPMENT_DB
    if not _EQUIPMENT_DB:
        with open(_EQUIPMENT_DB_PATH) as f:
            _EQUIPMENT_DB = json.load(f)["equipment"]
    return _EQUIPMENT_DB


# ---------------------------------------------------------------------------
# Data fetchers (pipeline node functions)
# ---------------------------------------------------------------------------

def fetch_user_profile(user_id: str) -> dict:
    query = f"""
        SELECT * FROM `{_PROJECT}.{_DATASET}.user_profiles`
        WHERE user_id = @user_id LIMIT 1
    """
    cfg = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("user_id", "STRING", user_id)]
    )
    rows = list(_bq().query(query, job_config=cfg).result())
    if not rows:
        raise ValueError(f"User not found: {user_id}")
    return dict(rows[0])


def fetch_latest_score(user_id: str) -> dict:
    query = f"""
        SELECT * FROM `{_PROJECT}.{_DATASET}.risk_scores`
        WHERE user_id = @user_id
        ORDER BY timestamp DESC LIMIT 1
    """
    cfg = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("user_id", "STRING", user_id)]
    )
    rows = list(_bq().query(query, job_config=cfg).result())
    if not rows:
        raise ValueError(f"No score found for user: {user_id}")
    return dict(rows[0])


def get_equipment_specs(user_profile: dict) -> dict:
    """Match user's equipment type to the equipment DB for detailed power specs."""
    db = _load_equipment_db()
    condition = (user_profile.get("condition") or "").lower()
    equipment = user_profile.get("equipment") or {}
    eq_type = (equipment.get("type") or "").lower()

    # Try to match on condition first, then equipment type string
    for entry in db:
        if entry["type"] == condition:
            return entry
        if entry["name"].lower() in eq_type or eq_type in entry["name"].lower():
            return entry

    return {"type": condition, "watts_typical": equipment.get("power_watts"), "criticality": "HIGH"}


# ---------------------------------------------------------------------------
# Gemini prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(user: dict, score: dict, equipment: dict) -> str:
    condition = user.get("condition", "other")
    name = user.get("name", "the patient")
    age = user.get("age", "")
    risk_level = score.get("risk_level", "ELEVATED")
    primary_threat = score.get("primary_threat", "grid")
    composite = score.get("composite_score", 0)
    hours_to_action = score.get("hours_to_action", 24)
    has_red_flag = score.get("has_red_flag_warning", False)
    active_psps = score.get("active_psps", False)
    backup_hours = (user.get("equipment") or {}).get("backup_hours", 0)
    language = user.get("preferred_language", "en")
    can_evacuate = user.get("can_self_evacuate", True)
    caregiver = user.get("caregiver") or {}
    medications = user.get("medications") or []
    nearest = user.get("nearest_resources") or {}

    meds_str = ", ".join(
        f"{m.get('name', '')}{'(refrigeration required)' if m.get('requires_refrigeration') else ''}{'(heat-sensitive)' if m.get('heat_sensitive') else ''}{'(beta-blocker - impairs heat response)' if m.get('beta_blocker') else ''}"
        for m in medications
    ) or "None listed"

    prompt = f"""You are an emergency preparedness advisor for medically vulnerable Californians.

Generate a personalised action plan for the following patient facing an imminent {primary_threat} risk event.

## Patient Profile
- Name: {name}, Age: {age}
- Medical condition: {condition}
- Primary equipment: {equipment.get('name') or equipment.get('type', 'unknown')} ({equipment.get('watts_typical', 'unknown')}W typical draw)
- Battery backup available: {backup_hours} hours
- Can self-evacuate: {can_evacuate}
- Medications: {meds_str}
- Language preference: {language}

## Current Risk
- Composite risk score: {composite:.0f}/100
- Risk level: {risk_level}
- Primary threat: {primary_threat}
- Hours until action needed: {hours_to_action}
- Red Flag Warning active: {has_red_flag}
- PSPS event active: {active_psps}

## Nearest Resources
- Hospital: {nearest.get('hospital_name', 'unknown')} ({nearest.get('hospital_miles', '?')} miles)
- Cooling center: {nearest.get('cooling_center', 'unknown')}
- Pharmacy: {nearest.get('pharmacy_name', 'unknown')}

## Caregiver
- {caregiver.get('name', 'None')} ({caregiver.get('relationship', '')}) — {caregiver.get('phone', '')}

## Instructions
Generate a ranked action checklist with 5-8 specific, actionable items.
For each item output EXACTLY this format (one per line):
[URGENCY] ACTION: Detail

URGENCY must be one of: NOW, TODAY, BEFORE_EVENT, DURING, AFTER
- NOW: immediate action required (within the hour)
- TODAY: action needed before end of day
- BEFORE_EVENT: do before the outage/event hits
- DURING: do if/when the event is happening
- AFTER: recovery actions

Be specific to this patient's condition ({condition}), equipment, and medications.
Do NOT give generic advice. Reference the patient's actual equipment, backup hours, and nearest resources by name.
{"Write the plan in Korean." if language == "ko" else ""}
"""
    return prompt


# ---------------------------------------------------------------------------
# Gemini call + response parser
# ---------------------------------------------------------------------------

_URGENCY_RE = re.compile(
    r"\[(NOW|TODAY|BEFORE_EVENT|DURING|AFTER)\]\s+(.+?):\s+(.+)", re.IGNORECASE
)


def _parse_gemini_output(raw: str) -> list[dict]:
    items = []
    for i, line in enumerate(raw.splitlines()):
        m = _URGENCY_RE.search(line.strip())
        if m:
            items.append({
                "order": i + 1,
                "urgency": m.group(1).upper(),
                "action": m.group(2).strip(),
                "detail": m.group(3).strip(),
                "completed": False,
            })
    return items


def generate_action_plan(user_profile: dict, risk_score: dict, equipment_specs: dict) -> dict:
    """
    Call Gemini Pro to generate a condition-specific action plan.
    Returns a dict shaped for vitaguard.action_plans.
    """
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(_GEMINI_MODEL)

    prompt = _build_prompt(user_profile, risk_score, equipment_specs)
    response = model.generate_content(prompt)
    raw_output = response.text

    action_items = _parse_gemini_output(raw_output)

    return {
        "plan_id": str(uuid.uuid4()),
        "user_id": user_profile["user_id"],
        "score_id": risk_score.get("score_id"),
        "generated_at": _utc_now(),
        "risk_level": risk_score.get("risk_level"),
        "primary_threat": risk_score.get("primary_threat"),
        "action_items": action_items,
        "gemini_raw_output": raw_output,
        "language": user_profile.get("preferred_language", "en"),
        "caregiver_notified": False,
    }


# ---------------------------------------------------------------------------
# Storage + notification stubs
# ---------------------------------------------------------------------------

def store_action_plan(action_plan: dict) -> None:
    """Write action plan to vitaguard.action_plans."""
    table_id = f"{_PROJECT}.{_DATASET}.action_plans"
    row = dict(action_plan)
    errors = _bq().insert_rows_json(table_id, [row])
    if errors:
        raise RuntimeError(f"Failed to store action plan: {errors}")
    print(f"  Action plan stored: {row['plan_id']} for user {row['user_id']}")


def send_notifications(user_profile: dict, risk_score: dict, action_plan: dict) -> None:
    """
    Placeholder for push/SMS/call notification logic.
    In production: integrate with FCM (push), Twilio (SMS/voice), or similar.
    """
    level = risk_score.get("risk_level", "UNKNOWN")
    caregiver = user_profile.get("caregiver") or {}
    caregiver_threshold = caregiver.get("notify_threshold", "HIGH")

    should_notify_caregiver = level in (
        {"ELEVATED": {"ELEVATED", "HIGH", "CRITICAL"},
         "HIGH": {"HIGH", "CRITICAL"},
         "CRITICAL": {"CRITICAL"}}.get(caregiver_threshold, set())
    )

    print(f"  [notify] Push notification → {user_profile.get('name')}")
    if should_notify_caregiver and caregiver.get("phone"):
        print(f"  [notify] Caregiver alert → {caregiver.get('name')} ({caregiver.get('phone')})")
    else:
        print(f"  [notify] Caregiver threshold not met ({caregiver_threshold}) — no caregiver alert")


# ---------------------------------------------------------------------------
# Convenience: run full advisory flow for a single user
# ---------------------------------------------------------------------------

async def run_advisory_for_user(user_id: str) -> Optional[dict]:
    """Run the complete advisory pipeline for one user. Returns the action plan dict."""
    print(f"\nAdvisory pipeline: {user_id}")
    try:
        user = fetch_user_profile(user_id)
        score = fetch_latest_score(user_id)
        equipment = get_equipment_specs(user)
        plan = generate_action_plan(user, score, equipment)
        store_action_plan(plan)
        send_notifications(user, score, plan)
        return plan
    except Exception as e:
        print(f"  Advisory failed for {user_id}: {e}")
        return None
