"""
ingestion/calfire_client.py

CAL FIRE / NWS hazard alerts client.

CAL FIRE does not provide a public PSPS API. Instead we use the NWS alerts API
(api.weather.gov/alerts) which covers:
  - Red Flag Warnings (wildfire/wind conditions)
  - Extreme Heat Warnings / Heat Advisories
  - Evacuation Orders (issued via NWS in some CA counties)

Returns rows shaped for the vitaguard.hazard_alerts BigQuery table.

Usage:
    import asyncio
    from ingestion.calfire_client import fetch_active_alerts
    rows = asyncio.run(fetch_active_alerts())
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx

NWS_ALERTS_BASE = "https://api.weather.gov/alerts/active"

# NWS event names → our internal alert_type values
EVENT_TYPE_MAP = {
    "Red Flag Warning": "red_flag",
    "Fire Weather Watch": "red_flag",
    "Extreme Heat Warning": "heat",
    "Heat Advisory": "heat",
    "Excessive Heat Warning": "heat",
    "Evacuation - Immediate": "evacuation_order",
    "Evacuation Order": "evacuation_order",
    "Evacuation Warning": "evacuation_warning",
    # PSPS events are not issued via NWS — we flag them via CAISO flex alert correlation
}

_HEADERS = {
    "User-Agent": "Compass/1.0 (AI Medical Emergency Intelligence; contact@compass-ai.org)",
    "Accept": "application/geo+json",
}

# ZIP codes we care about for the demo
MONITORED_ZIPS = {"93720", "93722", "93706", "95969", "95928", "90034", "92103", "94025", "95814"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(ts: Optional[str]) -> Optional[str]:
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts)
        return dt.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError):
        return ts


def _extract_severity(props: dict) -> Optional[str]:
    return props.get("severity") or props.get("urgency")


def _alert_type(event: str) -> Optional[str]:
    for key, val in EVENT_TYPE_MAP.items():
        if key.lower() in event.lower():
            return val
    return None


async def _fetch_alerts(client: httpx.AsyncClient, event: str) -> list[dict]:
    """Fetch active NWS alerts for California filtered by event type."""
    params = {"area": "CA", "event": event}
    resp = await client.get(NWS_ALERTS_BASE, params=params, headers=_HEADERS)
    if resp.status_code != 200:
        print(f"[calfire_client] NWS alerts returned {resp.status_code} for event={event!r}")
        return []
    return resp.json().get("features", [])


def _feature_to_row(feature: dict) -> Optional[dict]:
    props = feature.get("properties", {})
    event = props.get("event", "")
    alert_type = _alert_type(event)
    if not alert_type:
        return None

    alert_id = props.get("id") or feature.get("id", "")

    # Affected zones: NWS uses zone codes like "CAZ015" — we include them as-is.
    # For ZIP matching, we rely on the caller to cross-reference zone → ZIP.
    affected_zones: list[str] = props.get("affectedZones", [])
    # Simplify zone URIs → zone code suffix (e.g. ".../CAZ015" → "CAZ015")
    zone_codes = [z.split("/")[-1] for z in affected_zones]

    return {
        "ingested_at": _utc_now(),
        "alert_id": alert_id,
        "alert_type": alert_type,
        "zip_codes_affected": zone_codes,  # zone codes, not ZIPs — downstream scoring uses lookup
        "severity": _extract_severity(props),
        "active": props.get("status", "").lower() == "actual",
        "issued_at": _parse_iso(props.get("sent")),
        "expires_at": _parse_iso(props.get("expires")),
    }


async def fetch_active_alerts() -> list[dict]:
    """
    Fetch all active wildfire/heat/evacuation alerts for California.
    Called by the RocketRide calfire-fetch pipeline node.
    """
    events_to_fetch = [
        "Red Flag Warning",
        "Fire Weather Watch",
        "Extreme Heat Warning",
        "Excessive Heat Warning",
        "Heat Advisory",
        "Evacuation - Immediate",
        "Evacuation Warning",
    ]

    async with httpx.AsyncClient(timeout=20.0) as client:
        tasks = [_fetch_alerts(client, event) for event in events_to_fetch]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    seen_ids: set[str] = set()
    rows: list[dict] = []

    for event, result in zip(events_to_fetch, results):
        if isinstance(result, Exception):
            print(f"[calfire_client] Error fetching {event!r}: {result}")
            continue
        for feature in result:
            row = _feature_to_row(feature)
            if row and row["alert_id"] not in seen_ids:
                seen_ids.add(row["alert_id"])
                rows.append(row)

    print(f"[calfire_client] Fetched {len(rows)} active CA hazard alerts")
    return rows
