"""api/routes/users.py — POST /users"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from google.cloud import bigquery

from api.models.user import UserProfile, UserProfileCreate

router = APIRouter()

_PROJECT = os.getenv("GCP_PROJECT_ID")
_DATASET = os.getenv("BQ_DATASET", "vitaguard")


def _client() -> bigquery.Client:
    return bigquery.Client(project=_PROJECT)


@router.post("/users", response_model=UserProfile, status_code=201)
async def create_user(body: UserProfileCreate) -> UserProfile:
    now = datetime.now(timezone.utc).isoformat()
    user_id = body.user_id or str(uuid.uuid4())

    row = body.model_dump(exclude={"user_id"})
    row["user_id"] = user_id
    row["created_at"] = now
    row["updated_at"] = now

    # Convert enums to string values for BigQuery
    row = _serialize(row)

    table_id = f"{_PROJECT}.{_DATASET}.user_profiles"
    errors = _client().insert_rows_json(table_id, [row])
    if errors:
        raise HTTPException(status_code=500, detail=f"BigQuery insert error: {errors}")

    return UserProfile(user_id=user_id, created_at=now, updated_at=now, **body.model_dump())


def _serialize(obj):
    """Recursively convert Pydantic enums / None nested objects to BQ-safe types."""
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items() if v is not None}
    if hasattr(obj, "value"):  # Enum
        return obj.value
    if isinstance(obj, list):
        return [_serialize(i) for i in obj]
    return obj
