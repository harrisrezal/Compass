"""
ingestion/bigquery_writer.py

Streaming-inserts ingestion and scoring results into the vitaguard BigQuery tables.

Usage (from pipeline):
    from ingestion.bigquery_writer import write_batch
    write_batch(grid_data=rows, weather_data=rows, alert_data=rows, risk_scores=rows)
"""

from __future__ import annotations

import os
from typing import Optional

from google.cloud import bigquery

_PROJECT = os.getenv("GCP_PROJECT_ID")
_DATASET = os.getenv("BQ_DATASET", "vitaguard")

# Table names
_GRID_STRESS = "grid_stress"
_WEATHER = "weather_conditions"
_ALERTS = "hazard_alerts"
_RISK_SCORES = "risk_scores"


def _client() -> bigquery.Client:
    if not _PROJECT:
        raise EnvironmentError("GCP_PROJECT_ID is not set in environment / .env")
    return bigquery.Client(project=_PROJECT)


def _insert(table_name: str, rows: list[dict]) -> None:
    if not rows:
        return
    client = _client()
    table_id = f"{_PROJECT}.{_DATASET}.{table_name}"
    errors = client.insert_rows_json(table_id, rows)
    if errors:
        raise RuntimeError(f"BigQuery insert errors for {table_id}: {errors}")
    print(f"  wrote {len(rows)} rows → {table_id}")


def write_grid_stress(rows: list[dict]) -> None:
    _insert(_GRID_STRESS, rows)


def write_weather(rows: list[dict]) -> None:
    _insert(_WEATHER, rows)


def write_alerts(rows: list[dict]) -> None:
    _insert(_ALERTS, rows)


def write_risk_scores(rows: list[dict]) -> None:
    _insert(_RISK_SCORES, rows)


def write_batch(
    grid_data: Optional[list[dict]] = None,
    weather_data: Optional[list[dict]] = None,
    alert_data: Optional[list[dict]] = None,
    risk_scores: Optional[list[dict]] = None,
) -> None:
    """
    Dispatch each data type to the correct BigQuery table.
    Called by the RocketRide bq-write pipeline node.
    """
    print("BigQuery write_batch starting...")
    if grid_data:
        write_grid_stress(grid_data)
    if weather_data:
        write_weather(weather_data)
    if alert_data:
        write_alerts(alert_data)
    if risk_scores:
        write_risk_scores(risk_scores)
    print("BigQuery write_batch complete.")
