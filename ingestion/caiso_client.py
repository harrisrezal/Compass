"""
ingestion/caiso_client.py

CAISO OASIS API client.

Fetches grid load forecast and current supply mix from the California ISO
OASIS public API and returns rows shaped for the vitaguard.grid_stress table.

CAISO OASIS API docs: http://oasis.caiso.com/mrioasis/logon.do
- SLD_FCST  — Day-ahead + real-time system load forecast
- ENE_SLRS  — Hourly supply (with renewable breakdown)

Usage:
    import asyncio
    from ingestion.caiso_client import CAISOClient

    rows = asyncio.run(CAISOClient().fetch_grid_stress(hours_ahead=72))
    for row in rows:
        print(row)
"""

from __future__ import annotations

import asyncio
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

# CAISO OASIS base URL
OASIS_BASE = "https://oasis.caiso.com/oasisapi/SingleZip"

# Namespace used in CAISO XML responses
_NS = {"ns": "http://www.caiso.com/soa/OASISReport_v1.xsd"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)


def _fmt(dt: datetime) -> str:
    """Format datetime as CAISO OASIS query param: YYYYMMDDTHH:MM-0000"""
    return dt.strftime("%Y%m%dT%H:%M-0000")


class CAISOClient:
    """
    Async client for the CAISO OASIS public API.

    All methods return lists of dicts matching the vitaguard.grid_stress
    BigQuery schema:
        ingested_at       TIMESTAMP  (when the row was written)
        forecast_hour     TIMESTAMP  (the hour the reading applies to)
        load_mw           FLOAT
        capacity_mw       FLOAT      (None — not directly available from OASIS load query)
        stress_pct        FLOAT      (load_mw / capacity_mw * 100, or None)
        renewable_pct     FLOAT
        flex_alert_active BOOL       (False by default; set by alert check)
    """

    def __init__(self, timeout: float = 30.0) -> None:
        self._timeout = timeout

    async def fetch_grid_stress(self, hours_ahead: int = 72) -> list[dict]:
        """
        Fetch load forecast and renewable supply mix for the next `hours_ahead`
        hours and merge into grid_stress rows.

        Makes two concurrent OASIS requests:
          1. SLD_FCST  — system load forecast
          2. ENE_SLRS  — energy supply (for renewable_pct)
        """
        start = _utc_now()
        end = start + timedelta(hours=hours_ahead)

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            load_task = asyncio.create_task(self._fetch_load_forecast(client, start, end))
            supply_task = asyncio.create_task(self._fetch_supply(client, start, end))
            load_rows, supply_rows = await asyncio.gather(load_task, supply_task)

        return _merge_rows(load_rows, supply_rows)

    async def _fetch_load_forecast(
        self,
        client: httpx.AsyncClient,
        start: datetime,
        end: datetime,
    ) -> list[dict]:
        params = {
            "queryname": "SLD_FCST",
            "startdatetime": _fmt(start),
            "enddatetime": _fmt(end),
            "version": "1",
            "resultformat": "6",  # XML
        }
        resp = await client.get(OASIS_BASE, params=params)
        resp.raise_for_status()
        return _parse_load_xml(resp.text)

    async def _fetch_supply(
        self,
        client: httpx.AsyncClient,
        start: datetime,
        end: datetime,
    ) -> list[dict]:
        params = {
            "queryname": "ENE_SLRS",
            "startdatetime": _fmt(start),
            "enddatetime": _fmt(end),
            "version": "1",
            "resultformat": "6",
        }
        resp = await client.get(OASIS_BASE, params=params)
        resp.raise_for_status()
        return _parse_supply_xml(resp.text)


def _parse_load_xml(xml_text: str) -> list[dict]:
    """
    Parse SLD_FCST XML response into a list of:
        {forecast_hour, load_mw}
    """
    root = ET.fromstring(xml_text)
    rows: list[dict] = []

    for report_data in root.findall(".//REPORT_DATA", _NS) or root.iter("REPORT_DATA"):
        interval_start = _find_text(report_data, "INTERVAL_START_GMT") or _find_text(report_data, "OPR_DT")
        load_mw = _find_float(report_data, "VALUE")
        if interval_start and load_mw is not None:
            rows.append({
                "forecast_hour": _parse_caiso_ts(interval_start),
                "load_mw": load_mw,
            })
    return rows


def _parse_supply_xml(xml_text: str) -> list[dict]:
    """
    Parse ENE_SLRS XML response into a list of:
        {forecast_hour, renewable_pct}

    CAISO ENE_SLRS provides total and renewable generation; we compute
    renewable_pct = renewable_mw / total_mw * 100.
    """
    root = ET.fromstring(xml_text)
    totals: dict[str, float] = {}
    renewables: dict[str, float] = {}

    for report_data in root.findall(".//REPORT_DATA", _NS) or root.iter("REPORT_DATA"):
        interval_start = _find_text(report_data, "INTERVAL_START_GMT") or _find_text(report_data, "OPR_DT")
        fuel_type = _find_text(report_data, "FUEL_TYPE") or ""
        value = _find_float(report_data, "VALUE")
        if not interval_start or value is None:
            continue
        ts = _parse_caiso_ts(interval_start)
        totals[ts] = totals.get(ts, 0.0) + value
        if fuel_type.upper() in {"SOLAR", "WIND", "GEOTHERMAL", "BIOMASS", "BIOGAS", "SMALL HYDRO", "HYDRO"}:
            renewables[ts] = renewables.get(ts, 0.0) + value

    rows: list[dict] = []
    for ts, total in totals.items():
        renewable_pct = (renewables.get(ts, 0.0) / total * 100) if total > 0 else None
        rows.append({"forecast_hour": ts, "renewable_pct": renewable_pct})
    return rows


def _merge_rows(load_rows: list[dict], supply_rows: list[dict]) -> list[dict]:
    """Merge load and supply rows on forecast_hour into grid_stress schema rows."""
    ingested_at = _utc_now().isoformat()

    supply_map: dict[str, float | None] = {r["forecast_hour"]: r.get("renewable_pct") for r in supply_rows}

    merged: list[dict] = []
    for lr in load_rows:
        fh = lr["forecast_hour"]
        load_mw = lr.get("load_mw")
        renewable_pct = supply_map.get(fh)
        merged.append({
            "ingested_at": ingested_at,
            "forecast_hour": fh,
            "load_mw": load_mw,
            "capacity_mw": None,       # Not directly available from OASIS SLD_FCST
            "stress_pct": None,        # Computed once capacity_mw is known
            "renewable_pct": renewable_pct,
            "flex_alert_active": False,
        })
    return merged


def _find_text(element: ET.Element, tag: str) -> Optional[str]:
    child = element.find(tag) or element.find(f"ns:{tag}", _NS)
    return child.text.strip() if child is not None and child.text else None


def _find_float(element: ET.Element, tag: str) -> Optional[float]:
    text = _find_text(element, tag)
    try:
        return float(text) if text is not None else None
    except ValueError:
        return None


def _parse_caiso_ts(ts_str: str) -> str:
    """
    Convert CAISO timestamp strings to ISO 8601 UTC.
    CAISO uses formats like: "2024-06-01T14:00:00-07:00" or "20240601"
    """
    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M%z",
        "%Y%m%dT%H:%M%z",
        "%Y%m%d",
    ):
        try:
            dt = datetime.strptime(ts_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
        except ValueError:
            continue
    # Return as-is if parsing fails — better than dropping the row
    return ts_str
