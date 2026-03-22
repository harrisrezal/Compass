# Compass — Claude Code Context

## What This Project Is

Compass is an AI medical emergency intelligence system for medically vulnerable Californians (home oxygen, dialysis, ventilators, power wheelchairs). It predicts energy and disaster risks 48-72 hours ahead and delivers personalised action plans.

Built for the 2025 AI Hackathon.

## GCP Project

- **Project ID:** `waybackhome-whvw1t598hcl0gkc6u`
- **BigQuery dataset:** `vitaguard`
- **Location:** `us-central1`

## Tech Stack

- **Backend:** Python 3.14 · FastAPI · Pydantic v2
- **AI Pipeline:** RocketRide (VS Code extension + Python SDK)
- **AI Models:** Vertex AI AutoML (forecasting) · Gemini Pro (advisory)
- **Database:** Google BigQuery (`vitaguard` dataset)
- **APIs:** CAISO OASIS · NOAA/NWS · CAL FIRE (via NWS) · FEMA
- **Python env:** `.venv/` — always use `.venv/bin/python` to run scripts

## Project Layout

```
bigquery/
  create_tables.py      — creates vitaguard dataset + 8 tables
  seed_users.py         — seeds 3 demo users into user_profiles
  schemas/              — BigQuery JSON schema definitions (source of truth)

ingestion/
  caiso_client.py       — CAISO OASIS API → grid_stress rows
  noaa_client.py        — NWS API → weather_conditions rows (no key required)
  calfire_client.py     — NWS alerts API → hazard_alerts rows
  bigquery_writer.py    — write_batch() → streams all data to BQ

scoring/
  weights.py            — constants: weights, multipliers, thresholds
  normalise.py          — raw signals → 0-100 per component
  composite.py          — weighted score + persona multiplier → risk_score rows

api/
  main.py               — FastAPI app entry point (uvicorn api.main:app)
  models/               — Pydantic v2 models (user, score, plan, welfare)
  routes/               — FastAPI route handlers (users, scores, plans, welfare)

files/
  ingestion_pipeline.json  — RocketRide pipeline definition (authoritative for function names)
  advisory_pipeline.json   — RocketRide Gemini advisory pipeline
  demo_users.json          — 3 demo personas (Margaret, James, Dorothy)
  zip_*.json               — static lookup tables (flood, HFTD, outage history)
  ARCHITECTURE.md          — full system architecture (scoring weights, multipliers)
  README.md                — project overview + demo scenario
```

## BigQuery Tables (vitaguard dataset)

| Table | Partitioned on | Clustered on |
|---|---|---|
| `grid_stress` | `forecast_hour` | — |
| `weather_conditions` | `forecast_hour` | `zip_code` |
| `hazard_alerts` | `ingested_at` | `alert_type` |
| `historical_outages` | — (static) | — |
| `risk_scores` | `timestamp` | `user_id` |
| `user_profiles` | — | — |
| `welfare_checks` | `triggered_at` | `user_id` |
| `action_plans` | `generated_at` | `user_id` |

## Demo Personas

| User | ZIP | Condition | Score target |
|---|---|---|---|
| Margaret Rodriguez | 93720 (Fresno) | oxygen, no backup | ~91 CRITICAL |
| James Thornton | 95969 (Paradise) | ventilator, generator | ~74 HIGH |
| Dorothy Kim | 90034 (LA) | heat_vulnerable | ~58 ELEVATED |

## Scoring Logic

1. Raw signals normalised to 0-100 (`scoring/normalise.py`)
2. Weighted composite: grid 35% · heat 25% · wildfire 20% · flood 10% · history 10%
3. Persona multiplier: ventilator 1.5x · oxygen 1.3x · dialysis 1.2x · wheelchair 1.1x
4. Backup modifier: no backup +30% · 12h+ backup -20%
5. Alert thresholds: 60 → advisory · 80 → escalation · 95 → critical

## Key Commands

```bash
# Run BigQuery setup
.venv/bin/python bigquery/create_tables.py --project=waybackhome-whvw1t598hcl0gkc6u
.venv/bin/python bigquery/seed_users.py --project=waybackhome-whvw1t598hcl0gkc6u

# Start API server
.venv/bin/uvicorn api.main:app --reload --port 8000

# Auth
gcloud auth application-default login
```

## What Still Needs Building

- [ ] `scoring/advisory.py` — Gemini Pro action plan generation
- [ ] End-to-end pipeline test runner
- [ ] Frontend (React) — patient app, caregiver app, caseworker dashboard
- [ ] RocketRide pipeline wiring

## Git & PR Workflow

**Never commit directly to `main`.** Always work on a feature branch and open a PR.

```bash
# Start every piece of work like this:
git checkout main && git pull
git checkout -b feat/your-feature-name

# When done, push and open a PR:
git push -u origin feat/your-feature-name
gh pr create --title "..." --body "..."
```

- Branch names: `feat/`, `fix/`, `chore/` prefixes
- Merging a PR to `main` automatically triggers GitHub Actions to deploy both Cloud Run services
- After each PR is merged, start the next task on a **new branch from the updated main**

## Conventions

- All BigQuery writes use `client.insert_rows_json()` (streaming insert)
- All ingestion clients are async (`asyncio` + `httpx`)
- Pydantic models live in `api/models/` and are reused in routes
- Static lookup data (flood zones, outage history, HFTD) lives in `files/` as JSON
- Never hardcode the project ID — read from `GCP_PROJECT_ID` env var (`.env` loaded via `python-dotenv`)
