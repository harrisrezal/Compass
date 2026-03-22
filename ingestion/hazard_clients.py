"""ingestion/hazard_clients.py

Five independent hazard data fetchers.
Each returns a raw dict used by scoring/hazard_scorer.py.

All fetchers are async (httpx).  On network failure they return a
minimal dict so scoring can still run and emit a LOW level.

Pass simulate=True to get deterministic demo data without any HTTP
calls — useful for hackathon demos and testing.
"""

from __future__ import annotations

import asyncio
import math
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx


# ── helpers ───────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Approximate great-circle distance in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _point_in_bbox(lat: float, lng: float, bbox: list[float]) -> bool:
    """bbox = [minLng, minLat, maxLng, maxLat]"""
    return bbox[1] <= lat <= bbox[3] and bbox[0] <= lng <= bbox[2]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── simulate data ─────────────────────────────────────────────────────────────

def _simulate_all() -> dict[str, dict[str, Any]]:
    """Return a fixed HIGH/CRITICAL/MODERATE demo dataset for demos."""
    return {
        "psps": {
            "in_active_shutoff": False,
            "in_warned_zone": True,
            "hours_to_shutoff": 4.5,
            "in_watch_zone": False,
            "utility": "PG&E",
        },
        "wildfire": {
            "evacuation_order": False,
            "evacuation_warning": True,
            "nearest_fire_km": 3.2,
            "red_flag_warning": True,
            "aqi": 175,
            "fire_name": "Demo Canyon Fire",
        },
        "flood": {
            "flash_flood_emergency": False,
            "flood_warning": True,
            "flood_watch": False,
            "fema_zone": "AE",
            "gauge_pct_above_flood_stage": 0.65,
        },
        "heat": {
            "excessive_heat_warning": True,
            "heat_advisory": False,
            "heat_index_f": 112.0,
            "overnight_low_f": 82.0,
        },
        "earthquake": {
            "max_magnitude": 4.8,
            "nearest_quake_km": 14.0,
            "hours_ago": 1.2,
            "on_liquefaction_zone": False,
        },
    }


# ── PSPS ──────────────────────────────────────────────────────────────────────

async def fetch_psps(lat: float, lng: float) -> dict[str, Any]:
    """
    Check PG&E, SCE, and SDG&E public outage/PSPS feeds for the given point.
    Returns zone membership and shutoff timing.
    """
    result: dict[str, Any] = {
        "in_active_shutoff": False,
        "in_warned_zone": False,
        "hours_to_shutoff": None,
        "in_watch_zone": False,
        "utility": None,
    }

    # PG&E current outage GeoJSON — public, no auth required
    pge_url = "https://pgealerts.alerts.pge.com/outagemap/resources/outageDataV2.json"
    sce_url = "https://www.sce.com/wps/portal/home/Outage-Center/Current-Outages/!ut/p/z1/outage-api/current-outages.json"

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(pge_url)
            if resp.status_code == 200:
                data = resp.json()
                # PG&E returns currentOutages list; check if user lat/lng is near any
                outages = data.get("currentOutages", [])
                for o in outages:
                    try:
                        olat = float(o.get("latitude", 0))
                        olng = float(o.get("longitude", 0))
                        if _haversine_km(lat, lng, olat, olng) < 5.0:
                            result["in_active_shutoff"] = True
                            result["utility"] = "PG&E"
                    except (TypeError, ValueError):
                        continue
        except Exception:
            pass

        # NWS PSPS alerts as fallback signal
        try:
            nws_url = "https://api.weather.gov/alerts/active?event=Public+Safety+Power+Shutoff"
            resp = await client.get(nws_url, headers={"User-Agent": "compass-app/1.0"})
            if resp.status_code == 200:
                features = resp.json().get("features", [])
                for f in features:
                    props = f.get("properties", {})
                    geo = f.get("geometry") or {}
                    event = props.get("event", "")
                    status = props.get("status", "")

                    # rough bbox check
                    if geo.get("type") == "Polygon":
                        coords = geo["coordinates"][0]
                        lngs = [c[0] for c in coords]
                        lats = [c[1] for c in coords]
                        bbox = [min(lngs), min(lats), max(lngs), max(lats)]
                        if not _point_in_bbox(lat, lng, bbox):
                            continue
                    elif geo.get("type") == "MultiPolygon":
                        pass  # skip detailed check for now

                    onset = props.get("onset")
                    if onset:
                        try:
                            onset_dt = datetime.fromisoformat(onset.replace("Z", "+00:00"))
                            hours = (onset_dt - datetime.now(timezone.utc)).total_seconds() / 3600
                            result["hours_to_shutoff"] = round(hours, 1)
                        except ValueError:
                            pass

                    if "Watch" in event or status == "Watch":
                        result["in_watch_zone"] = True
                    elif "Warning" in event or status == "Warning":
                        result["in_warned_zone"] = True
                    elif status == "Actual":
                        result["in_active_shutoff"] = True

                    if not result["utility"]:
                        result["utility"] = "PG&E/SCE/SDG&E"
        except Exception:
            pass

    return result


# ── WILDFIRE ──────────────────────────────────────────────────────────────────

async def fetch_wildfire(lat: float, lng: float) -> dict[str, Any]:
    """
    Fetch wildfire data: NASA FIRMS hotspots, NWS Red Flag Warnings, AirNow AQI.
    Returns evac status, nearest fire distance, AQI.
    """
    result: dict[str, Any] = {
        "evacuation_order": False,
        "evacuation_warning": False,
        "nearest_fire_km": 999.0,
        "red_flag_warning": False,
        "aqi": 0,
        "fire_name": None,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        # NWS: Red Flag Warning
        try:
            nws_url = "https://api.weather.gov/alerts/active?event=Red+Flag+Warning"
            resp = await client.get(nws_url, headers={"User-Agent": "compass-app/1.0"})
            if resp.status_code == 200:
                for f in resp.json().get("features", []):
                    props = f.get("properties", {})
                    geo = f.get("geometry") or {}
                    if geo.get("type") == "Polygon":
                        coords = geo["coordinates"][0]
                        lngs = [c[0] for c in coords]
                        lats = [c[1] for c in coords]
                        bbox = [min(lngs), min(lats), max(lngs), max(lats)]
                        if _point_in_bbox(lat, lng, bbox):
                            result["red_flag_warning"] = True
                    else:
                        # if geometry is missing, check centroid fallback
                        result["red_flag_warning"] = True
        except Exception:
            pass

        # NWS: Evacuation warnings/orders
        try:
            evac_url = "https://api.weather.gov/alerts/active?event=Evacuation+Immediate"
            resp = await client.get(evac_url, headers={"User-Agent": "compass-app/1.0"})
            if resp.status_code == 200:
                for f in resp.json().get("features", []):
                    result["evacuation_order"] = True

            evac_warn_url = "https://api.weather.gov/alerts/active?event=Evacuation+Warning"
            resp = await client.get(evac_warn_url, headers={"User-Agent": "compass-app/1.0"})
            if resp.status_code == 200:
                for f in resp.json().get("features", []):
                    props = f.get("properties", {})
                    geo = f.get("geometry") or {}
                    if geo.get("type") == "Polygon":
                        coords = geo["coordinates"][0]
                        lngs = [c[0] for c in coords]
                        lats = [c[1] for c in coords]
                        bbox = [min(lngs), min(lats), max(lngs), max(lats)]
                        if _point_in_bbox(lat, lng, bbox):
                            result["evacuation_warning"] = True
                    else:
                        result["evacuation_warning"] = True
        except Exception:
            pass

        # NASA FIRMS: active fire hotspots (last 24h, 1km resolution)
        firms_key = __import__("os").getenv("NASA_FIRMS_MAP_KEY", "")
        if firms_key:
            try:
                # Area feed: lat-lng bounding box ± 1 degree
                bbox_str = f"{lng-1},{lat-1},{lng+1},{lat+1}"
                firms_url = (
                    f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
                    f"{firms_key}/VIIRS_SNPP_NRT/{bbox_str}/1"
                )
                resp = await client.get(firms_url)
                if resp.status_code == 200:
                    lines = resp.text.strip().split("\n")
                    for line in lines[1:]:  # skip header
                        parts = line.split(",")
                        if len(parts) >= 2:
                            try:
                                flat, flng = float(parts[0]), float(parts[1])
                                dist = _haversine_km(lat, lng, flat, flng)
                                if dist < result["nearest_fire_km"]:
                                    result["nearest_fire_km"] = round(dist, 1)
                            except ValueError:
                                continue
            except Exception:
                pass

        # AirNow AQI
        airnow_key = __import__("os").getenv("AIRNOW_API_KEY", "")
        if airnow_key:
            try:
                airnow_url = (
                    f"https://www.airnowapi.org/aq/observation/latLong/current/"
                    f"?format=application/json"
                    f"&latitude={lat}&longitude={lng}"
                    f"&distance=25&API_KEY={airnow_key}"
                )
                resp = await client.get(airnow_url)
                if resp.status_code == 200:
                    obs = resp.json()
                    if obs:
                        result["aqi"] = max(o.get("AQI", 0) for o in obs)
            except Exception:
                pass

    return result


# ── FLOOD ─────────────────────────────────────────────────────────────────────

async def fetch_flood(lat: float, lng: float) -> dict[str, Any]:
    """
    Fetch flood data: USGS real-time gauges, NWS Flood Warnings, FEMA flood zone.
    """
    result: dict[str, Any] = {
        "flash_flood_emergency": False,
        "flood_warning": False,
        "flood_watch": False,
        "fema_zone": "X",  # default safe zone
        "gauge_pct_above_flood_stage": 0.0,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        # NWS: Flash Flood Emergency
        try:
            ffe_url = "https://api.weather.gov/alerts/active?event=Flash+Flood+Emergency"
            resp = await client.get(ffe_url, headers={"User-Agent": "compass-app/1.0"})
            if resp.status_code == 200 and resp.json().get("features"):
                result["flash_flood_emergency"] = True
        except Exception:
            pass

        # NWS: Flood Warning and Watch
        try:
            fw_url = "https://api.weather.gov/alerts/active?event=Flood+Warning"
            resp = await client.get(fw_url, headers={"User-Agent": "compass-app/1.0"})
            if resp.status_code == 200:
                for f in resp.json().get("features", []):
                    geo = f.get("geometry") or {}
                    if geo.get("type") == "Polygon":
                        coords = geo["coordinates"][0]
                        lngs = [c[0] for c in coords]
                        lats = [c[1] for c in coords]
                        bbox = [min(lngs), min(lats), max(lngs), max(lats)]
                        if _point_in_bbox(lat, lng, bbox):
                            result["flood_warning"] = True
                    else:
                        result["flood_warning"] = True
        except Exception:
            pass

        try:
            fwa_url = "https://api.weather.gov/alerts/active?event=Flood+Watch"
            resp = await client.get(fwa_url, headers={"User-Agent": "compass-app/1.0"})
            if resp.status_code == 200 and resp.json().get("features"):
                result["flood_watch"] = True
        except Exception:
            pass

        # USGS Water Services: nearest gauge within 50km
        try:
            usgs_url = (
                f"https://waterservices.usgs.gov/nwis/iv/"
                f"?format=json&bBox={lng-0.5},{lat-0.5},{lng+0.5},{lat+0.5}"
                f"&parameterCd=00065&siteStatus=active"
            )
            resp = await client.get(usgs_url)
            if resp.status_code == 200:
                data = resp.json()
                time_series = data.get("value", {}).get("timeSeries", [])
                for ts in time_series:
                    site = ts.get("sourceInfo", {})
                    geo_data = site.get("geoLocation", {}).get("geogLocation", {})
                    slat = geo_data.get("latitude", 0)
                    slng = geo_data.get("longitude", 0)
                    if _haversine_km(lat, lng, slat, slng) > 30:
                        continue
                    values = ts.get("values", [{}])[0].get("value", [])
                    if values:
                        try:
                            stage = float(values[-1].get("value", 0))
                            # rough pct above flood stage (assume flood stage ~15ft)
                            result["gauge_pct_above_flood_stage"] = max(0, (stage - 15) / 15)
                        except (ValueError, ZeroDivisionError):
                            pass
        except Exception:
            pass

        # FEMA NFHL flood zone via ArcGIS
        try:
            fema_url = (
                "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"
                f"?geometry={lng},{lat}&geometryType=esriGeometryPoint"
                "&inSR=4326&spatialRel=esriSpatialRelIntersects"
                "&outFields=FLD_ZONE&returnGeometry=false&f=json"
            )
            resp = await client.get(fema_url, timeout=8.0)
            if resp.status_code == 200:
                features = resp.json().get("features", [])
                if features:
                    zone = features[0].get("attributes", {}).get("FLD_ZONE", "X")
                    result["fema_zone"] = zone or "X"
        except Exception:
            pass

    return result


# ── HEAT ──────────────────────────────────────────────────────────────────────

async def fetch_heat(lat: float, lng: float) -> dict[str, Any]:
    """
    Fetch heat data: NWS Heat alerts, OpenWeatherMap current + overnight low.
    """
    result: dict[str, Any] = {
        "excessive_heat_warning": False,
        "heat_advisory": False,
        "heat_index_f": 0.0,
        "overnight_low_f": 0.0,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        # NWS: Excessive Heat Warning
        try:
            ehw_url = "https://api.weather.gov/alerts/active?event=Excessive+Heat+Warning"
            resp = await client.get(ehw_url, headers={"User-Agent": "compass-app/1.0"})
            if resp.status_code == 200:
                for f in resp.json().get("features", []):
                    geo = f.get("geometry") or {}
                    if geo.get("type") == "Polygon":
                        coords = geo["coordinates"][0]
                        lngs_list = [c[0] for c in coords]
                        lats_list = [c[1] for c in coords]
                        bbox = [min(lngs_list), min(lats_list), max(lngs_list), max(lats_list)]
                        if _point_in_bbox(lat, lng, bbox):
                            result["excessive_heat_warning"] = True
                    else:
                        result["excessive_heat_warning"] = True
        except Exception:
            pass

        # NWS: Heat Advisory
        try:
            ha_url = "https://api.weather.gov/alerts/active?event=Heat+Advisory"
            resp = await client.get(ha_url, headers={"User-Agent": "compass-app/1.0"})
            if resp.status_code == 200 and resp.json().get("features"):
                result["heat_advisory"] = True
        except Exception:
            pass

        # OpenWeatherMap: current heat index + forecast overnight low
        owm_key = __import__("os").getenv("OPENWEATHERMAP_API_KEY", "")
        if owm_key:
            try:
                current_url = (
                    f"https://api.openweathermap.org/data/2.5/weather"
                    f"?lat={lat}&lon={lng}&appid={owm_key}&units=imperial"
                )
                resp = await client.get(current_url)
                if resp.status_code == 200:
                    d = resp.json()
                    feels_like = d.get("main", {}).get("feels_like", 0)
                    result["heat_index_f"] = round(feels_like, 1)

                forecast_url = (
                    f"https://api.openweathermap.org/data/2.5/forecast"
                    f"?lat={lat}&lon={lng}&appid={owm_key}&units=imperial&cnt=16"
                )
                resp = await client.get(forecast_url)
                if resp.status_code == 200:
                    items = resp.json().get("list", [])
                    # find tonight's low (next 24h, dt_txt contains "night" or min temp)
                    lows = [i["main"]["temp_min"] for i in items if "main" in i]
                    if lows:
                        result["overnight_low_f"] = round(min(lows), 1)
            except Exception:
                pass

    return result


# ── EARTHQUAKE ────────────────────────────────────────────────────────────────

async def fetch_earthquake(lat: float, lng: float) -> dict[str, Any]:
    """
    Fetch recent USGS earthquake data and check liquefaction susceptibility.
    """
    result: dict[str, Any] = {
        "max_magnitude": 0.0,
        "nearest_quake_km": 999.0,
        "hours_ago": 999.0,
        "on_liquefaction_zone": False,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        # USGS FDSN: last 24h, M2.5+, within ~50km (roughly 0.5 degree)
        try:
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(hours=24)
            usgs_url = (
                "https://earthquake.usgs.gov/fdsnws/event/1/query"
                f"?format=geojson&minmagnitude=2.5"
                f"&starttime={start_time.strftime('%Y-%m-%dT%H:%M:%S')}"
                f"&endtime={end_time.strftime('%Y-%m-%dT%H:%M:%S')}"
                f"&latitude={lat}&longitude={lng}&maxradiuskm=50"
                "&orderby=magnitude"
            )
            resp = await client.get(usgs_url)
            if resp.status_code == 200:
                features = resp.json().get("features", [])
                for f in features:
                    props = f.get("properties", {})
                    coords = f.get("geometry", {}).get("coordinates", [])
                    if len(coords) >= 2:
                        qlng, qlat = coords[0], coords[1]
                        dist = _haversine_km(lat, lng, qlat, qlng)
                        mag = props.get("mag", 0) or 0
                        quake_time = props.get("time", 0)  # ms epoch
                        hours = (end_time.timestamp() * 1000 - quake_time) / 3_600_000

                        if dist < result["nearest_quake_km"]:
                            result["nearest_quake_km"] = round(dist, 1)
                        if mag > result["max_magnitude"]:
                            result["max_magnitude"] = round(mag, 1)
                            result["hours_ago"] = round(hours, 1)
        except Exception:
            pass

        # USGS liquefaction susceptibility (static GeoJSON — check by lat/lng bbox)
        # Simplified: flag high-risk zones by known California susceptibility areas
        # In production, query the full USGS layer; here we use a heuristic
        # (Bay Area alluvial basins, Sacramento Delta, LA Basin)
        HIGH_LIQUEFACTION_BBOXES = [
            [-122.6, 37.2, -121.7, 37.9],   # SF Bay Area alluvial zones
            [-121.9, 37.7, -121.3, 38.2],   # Sacramento Delta
            [-118.7, 33.8, -117.8, 34.1],   # LA Basin
            [-117.2, 32.7, -116.9, 33.0],   # San Diego
        ]
        for bbox in HIGH_LIQUEFACTION_BBOXES:
            if _point_in_bbox(lat, lng, bbox):
                result["on_liquefaction_zone"] = True
                break

    return result


# ── Main dispatcher ───────────────────────────────────────────────────────────

async def fetch_all_hazards(
    lat: float, lng: float, simulate: bool = False
) -> dict[str, dict[str, Any]]:
    """
    Fetch all 5 hazard datasets in parallel.
    Returns dict with keys: psps, wildfire, flood, heat, earthquake.
    """
    if simulate:
        return _simulate_all()

    psps, wildfire, flood, heat, quake = await asyncio.gather(
        fetch_psps(lat, lng),
        fetch_wildfire(lat, lng),
        fetch_flood(lat, lng),
        fetch_heat(lat, lng),
        fetch_earthquake(lat, lng),
        return_exceptions=False,
    )
    return {
        "psps": psps,
        "wildfire": wildfire,
        "flood": flood,
        "heat": heat,
        "earthquake": quake,
    }
