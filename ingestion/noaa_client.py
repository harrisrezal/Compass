"""
ingestion/noaa_client.py

NOAA/NWS API client for hourly weather forecasts.

The NWS API (api.weather.gov) is free and requires no API key.
Returns rows shaped for the vitaguard.weather_conditions BigQuery table.

Usage:
    import asyncio
    from ingestion.noaa_client import fetch_weather_all_zips
    rows = asyncio.run(fetch_weather_all_zips(["93720", "95969", "90034"]))
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx

NWS_BASE = "https://api.weather.gov"

# Hardcoded lat/lon centroids for the demo ZIPs (and a few extras).
# The NWS /points endpoint requires exact coordinates, so we resolve once here.
ZIP_COORDS: dict[str, tuple[float, float]] = {
    "93720": (36.8274, -119.7726),  # Fresno (Margaret)
    "93722": (36.7868, -119.8712),  # Fresno west
    "93706": (36.7107, -119.8126),  # Fresno south
    "95969": (39.7596, -121.6219),  # Paradise (James)
    "95928": (39.7285, -121.8375),  # Chico
    "90034": (34.0195, -118.3955),  # Culver City / LA (Dorothy)
    "92103": (32.7415, -117.1636),  # San Diego
    "94025": (37.4419, -122.1430),  # Menlo Park
    "95814": (38.5816, -121.4944),  # Sacramento
}

_HEADERS = {
    "User-Agent": "Compass/1.0 (AI Medical Emergency Intelligence; contact@compass-ai.org)",
    "Accept": "application/geo+json",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(ts: str) -> Optional[str]:
    try:
        dt = datetime.fromisoformat(ts)
        return dt.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError):
        return ts


async def _get_forecast_url(client: httpx.AsyncClient, lat: float, lon: float) -> Optional[str]:
    """Resolve ZIP coords → NWS forecast office → hourly forecast URL."""
    url = f"{NWS_BASE}/points/{lat:.4f},{lon:.4f}"
    resp = await client.get(url, headers=_HEADERS)
    if resp.status_code != 200:
        return None
    data = resp.json()
    return data.get("properties", {}).get("forecastHourly")


async def _fetch_hourly(client: httpx.AsyncClient, forecast_url: str, zip_code: str) -> list[dict]:
    """Fetch hourly forecast periods and return weather_conditions rows."""
    resp = await client.get(forecast_url, headers=_HEADERS)
    if resp.status_code != 200:
        return []
    data = resp.json()
    periods = data.get("properties", {}).get("periods", [])
    ingested_at = _utc_now()
    rows = []
    for p in periods:
        temp_f = p.get("temperature")
        # NWS hourly doesn't include heat index directly; approximate from temp + humidity
        humidity_pct = p.get("relativeHumidity", {}).get("value")
        wind_speed_raw = p.get("windSpeed", "")  # e.g. "10 mph" or "5 to 15 mph"
        wind_speed_mph = _parse_wind_speed(wind_speed_raw)
        heat_index_f = _calc_heat_index(temp_f, humidity_pct)

        rows.append({
            "ingested_at": ingested_at,
            "zip_code": zip_code,
            "forecast_hour": _parse_iso(p.get("startTime")),
            "temp_f": float(temp_f) if temp_f is not None else None,
            "heat_index_f": heat_index_f,
            "humidity_pct": float(humidity_pct) if humidity_pct is not None else None,
            "wind_speed_mph": wind_speed_mph,
        })
    return rows


def _parse_wind_speed(raw: str) -> Optional[float]:
    """Extract numeric mph from NWS wind speed strings like '10 mph' or '5 to 15 mph'."""
    if not raw:
        return None
    parts = raw.lower().replace("mph", "").strip().split()
    nums = []
    for p in parts:
        try:
            nums.append(float(p))
        except ValueError:
            pass
    if not nums:
        return None
    return sum(nums) / len(nums)  # average of range if given


def _calc_heat_index(temp_f: Optional[float], humidity_pct: Optional[float]) -> Optional[float]:
    """
    Rothfusz heat index equation (NWS standard).
    Only meaningful above 80°F and 40% humidity.
    """
    if temp_f is None or humidity_pct is None:
        return None
    t, rh = float(temp_f), float(humidity_pct)
    if t < 80:
        return t  # heat index = temp below threshold
    hi = (
        -42.379
        + 2.04901523 * t
        + 10.14333127 * rh
        - 0.22475541 * t * rh
        - 0.00683783 * t ** 2
        - 0.05481717 * rh ** 2
        + 0.00122874 * t ** 2 * rh
        + 0.00085282 * t * rh ** 2
        - 0.00000199 * t ** 2 * rh ** 2
    )
    return round(hi, 1)


async def fetch_weather_all_zips(zip_codes: list[str]) -> list[dict]:
    """
    Fetch hourly weather forecasts for all requested ZIP codes concurrently.
    Called by the RocketRide noaa-fetch pipeline node.
    """
    known_zips = [z for z in zip_codes if z in ZIP_COORDS]
    unknown = set(zip_codes) - set(known_zips)
    if unknown:
        print(f"[noaa_client] No coords for ZIPs: {unknown} — skipping")

    async with httpx.AsyncClient(timeout=20.0) as client:
        tasks = [_fetch_zip(client, z) for z in known_zips]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    rows: list[dict] = []
    for zip_code, result in zip(known_zips, results):
        if isinstance(result, Exception):
            print(f"[noaa_client] Error for ZIP {zip_code}: {result}")
        else:
            rows.extend(result)
    return rows


async def _fetch_zip(client: httpx.AsyncClient, zip_code: str) -> list[dict]:
    lat, lon = ZIP_COORDS[zip_code]
    forecast_url = await _get_forecast_url(client, lat, lon)
    if not forecast_url:
        print(f"[noaa_client] Could not resolve forecast URL for ZIP {zip_code}")
        return []
    return await _fetch_hourly(client, forecast_url, zip_code)
