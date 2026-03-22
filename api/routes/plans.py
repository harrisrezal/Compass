"""api/routes/plans.py — GET /plans/{user_id}"""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from google.cloud import bigquery

from api.models.plan import ActionPlan

router = APIRouter()

_PROJECT = os.getenv("GCP_PROJECT_ID")
_DATASET = os.getenv("BQ_DATASET", "vitaguard")


def _client() -> bigquery.Client:
    return bigquery.Client(project=_PROJECT)


@router.get("/plans/{user_id}", response_model=ActionPlan)
async def get_latest_plan(user_id: str) -> ActionPlan:
    query = f"""
        SELECT *
        FROM `{_PROJECT}.{_DATASET}.action_plans`
        WHERE user_id = @user_id
        ORDER BY generated_at DESC
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("user_id", "STRING", user_id)]
    )
    rows = list(_client().query(query, job_config=job_config).result())
    if not rows:
        raise HTTPException(status_code=404, detail=f"No action plan found for user {user_id}")
    return ActionPlan(**dict(rows[0]))
