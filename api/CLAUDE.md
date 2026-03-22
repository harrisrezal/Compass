# api/ — Claude Code Context

## Purpose

FastAPI backend serving risk scores, action plans, and welfare check triggers.
Reads from and writes to BigQuery `vitaguard` dataset.

## Running

```bash
.venv/bin/uvicorn api.main:app --reload --port 8000
# Docs at http://localhost:8000/docs
```

## Endpoints

| Method | Path | Handler | Description |
|---|---|---|---|
| `GET` | `/health` | `main.py` | Health check |
| `POST` | `/users` | `routes/users.py` | Onboard new user → `user_profiles` |
| `GET` | `/scores/{user_id}` | `routes/scores.py` | Latest risk score from `risk_scores` |
| `GET` | `/plans/{user_id}` | `routes/plans.py` | Latest action plan from `action_plans` |
| `POST` | `/welfare/check` | `routes/welfare.py` | Trigger welfare check → `welfare_checks` |

## Models

Pydantic v2 models in `api/models/` — reused across routes and as BQ row shapes:
- `user.py` — `UserProfile`, `UserProfileCreate`, `Equipment`, `Medication`, `Caregiver`
- `score.py` — `RiskScore`, `RiskLevel`, `PrimaryThreat`
- `plan.py` — `ActionPlan`, `ActionItem`, `Urgency`
- `welfare.py` — `WelfareCheck`, `WelfareCheckCreate`

## BQ query pattern

All routes use parameterised queries with `bigquery.ScalarQueryParameter` to prevent injection.
Writes use `client.insert_rows_json()` (streaming insert).

## Env vars required

`GCP_PROJECT_ID` and `BQ_DATASET` — loaded from `.env` via `python-dotenv` in `main.py`.
