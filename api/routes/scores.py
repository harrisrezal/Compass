"""api/routes/scores.py — GET /scores/{user_id}"""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from google.cloud import bigquery

from api.models.score import RiskScore

router = APIRouter()

_PROJECT = os.getenv("GCP_PROJECT_ID")
_DATASET = os.getenv("BQ_DATASET", "vitaguard")


def _client() -> bigquery.Client:
    return bigquery.Client(project=_PROJECT)


@router.get("/scores/{user_id}", response_model=RiskScore)
async def get_latest_score(user_id: str) -> RiskScore:
    query = f"""
        SELECT *
        FROM `{_PROJECT}.{_DATASET}.risk_scores`
        WHERE user_id = @user_id
        ORDER BY timestamp DESC
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("user_id", "STRING", user_id)]
    )
    rows = list(_client().query(query, job_config=job_config).result())
    if not rows:
        raise HTTPException(status_code=404, detail=f"No scores found for user {user_id}")
    return RiskScore(**dict(rows[0]))
