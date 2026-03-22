"""api/routes/welfare.py — POST /welfare/check"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from google.cloud import bigquery

from api.models.welfare import WelfareCheck, WelfareCheckCreate

router = APIRouter()

_PROJECT = os.getenv("GCP_PROJECT_ID")
_DATASET = os.getenv("BQ_DATASET", "vitaguard")


def _client() -> bigquery.Client:
    return bigquery.Client(project=_PROJECT)


@router.post("/welfare/check", response_model=WelfareCheck, status_code=201)
async def trigger_welfare_check(body: WelfareCheckCreate) -> WelfareCheck:
    now = datetime.now(timezone.utc).isoformat()
    check_id = str(uuid.uuid4())

    row = {
        "check_id": check_id,
        "user_id": body.user_id,
        "triggered_at": now,
        "trigger_reason": body.trigger_reason.value,
        "resolved": False,
        "caregiver_alerted": False,
    }

    table_id = f"{_PROJECT}.{_DATASET}.welfare_checks"
    errors = _client().insert_rows_json(table_id, [row])
    if errors:
        raise HTTPException(status_code=500, detail=f"BigQuery insert error: {errors}")

    return WelfareCheck(
        check_id=check_id,
        user_id=body.user_id,
        triggered_at=now,
        trigger_reason=body.trigger_reason,
        resolved=False,
        caregiver_alerted=False,
    )
