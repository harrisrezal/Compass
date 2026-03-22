# Compass — Claude Code Context

## What This Project Is

Compass is an AI medical emergency intelligence system for medically vulnerable Californians (home oxygen, dialysis, ventilators, power wheelchairs). It predicts energy and disaster risks 48-72 hours ahead and delivers personalised action plans. It also includes a public-facing natural disaster risk checker for any California address.

Built for the 2025 AI Hackathon.

## GCP Project

- **Project ID:** `waybackhome-whvw1t598hcl0gkc6u`
- **BigQuery dataset:** `vitaguard`
- **Location:** `us-central1`

## Live URLs

| Service | URL |
|---|---|
| Backend API | `https://compass-api-6agauuq6ma-uc.a.run.app` |
| Frontend | `https://compass-frontend-6agauuq6ma-uc.a.run.app` |
| Hazard checker | `https://compass-frontend-6agauuq6ma-uc.a.run.app/hazards` |
| Onboarding | `https://compass-frontend-6agauuq6ma-uc.a.run.app/onboarding` |
| Dashboard | `https://compass-frontend-6agauuq6ma-uc.a.run.app/dashboard/{user_id}` |

## Tech Stack

- **Backend:** Python 3.12 · FastAPI · Pydantic v2
- **Frontend:** Next.js 16 · React 19 · Tailwind CSS 4 · TypeScript
- **AI Models:** Gemini 2.5 Flash (advisory + alert generation + call scripts)
- **Database:** Google BigQuery (`vitaguard` dataset)
- **Maps:** Google Maps JS API (`@googlemaps/js-api-loader`)
- **APIs:** CAISO OASIS · NOAA/NWS · CAL FIRE (via NWS) · FEMA · USGS · NASA FIRMS (key needed) · AirNow (key needed) · OpenWeatherMap (key needed)
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
  hazard_clients.py     — 5 async hazard fetchers (PSPS, wildfire, flood, heat, earthquake)
                          simulate=True returns demo data without API keys

scoring/
  weights.py            — constants: weights, multipliers, thresholds
  normalise.py          — raw signals → 0-100 per component
  composite.py          — weighted score + persona multiplier → risk_score rows
  hazard_scorer.py      — 5 independent hazard scorers (LOW/MODERATE/HIGH/CRITICAL)
                          no composite score — each hazard stands alone

api/
  main.py               — FastAPI app entry point (uvicorn api.main:app)
  models/               — Pydantic v2 models (user, score, plan, welfare, hazard)
  routes/               — FastAPI route handlers (users, scores, plans, welfare, hazards)

frontend/caregiver-app/
  app/
    onboarding/         — single-page registration form (name, ZIP, condition, contact)
    dashboard/[userId]/ — caregiver dashboard (risk score, action plan, call button)
    hazards/            — natural disaster risk checker (5 hazard cards + map)
    chat/               — Gemini AI chat with patient context
    api/call-script/    — generates Gemini call script for MockCallModal
    api/chat/           — Gemini chat backend route
  components/
    dashboard/          — RiskScoreCard, ActionPlanChecklist, CallButton, MockCallModal
    hazards/            — HazardCard, HazardMap, HazardInputForm
  lib/
    api.ts              — typed fetch wrappers for backend API
    types.ts            — TypeScript types matching Pydantic models

files/
  ingestion_pipeline.json  — RocketRide pipeline definition
  advisory_pipeline.json   — RocketRide Gemini advisory pipeline
  demo_users.json          — 3 demo personas (Margaret, James, Dorothy)
  zip_*.json               — static lookup tables (flood, HFTD, outage history)
  ARCHITECTURE.md          — full system architecture (scoring weights, multipliers)
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/users` | Register patient (accepts optional `user_id` — used as CM-XXXX code) |
| GET | `/scores/{user_id}` | Latest risk score from BigQuery |
| GET | `/plans/{user_id}` | Latest action plan from BigQuery |
| POST | `/welfare/check` | Trigger welfare check + log to BigQuery |
| GET | `/hazards` | 5-hazard risk check for any address (`?address=&simulate=true`) |

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

| User | user_id | ZIP | Condition |
|---|---|---|---|
| Margaret Rodriguez | `demo-user-margaret-001` | 93720 (Fresno) | oxygen, no backup |
| James Thornton | `demo-user-james-001` | 95969 (Paradise) | ventilator, generator |
| Dorothy Kim | `demo-user-dorothy-001` | 90034 (LA) | heat_vulnerable |

Onboarding generates `CM-XXXX` codes (e.g. `CM-9K4R`) as user IDs — stored as-is in BigQuery.

## Hazard Alert System

`GET /hazards?address=Fresno+CA&simulate=true` returns 5 independent hazard levels (no composite):

- **PSPS** — PG&E/SCE/SDG&E shutoff zone check
- **Wildfire** — NASA FIRMS hotspots + NWS Red Flag + AirNow AQI
- **Flood** — USGS gauges + NWS Flood Warning + FEMA zone
- **Heat** — NWS Excessive Heat Warning + OpenWeatherMap
- **Earthquake** — USGS FDSN M2.5+ last 24h + liquefaction zone

Alert levels: LOW → MODERATE → HIGH → CRITICAL
- MODERATE+: Gemini generates a ≤40-word alert message
- HIGH/CRITICAL: 15-min ack timer (5s in demo mode) → fires MockCallModal call dispatch

**simulate=true** (default on frontend): returns deterministic HIGH/CRITICAL demo data — no external API keys needed.

## Scoring Logic (existing per-user composite)

1. Raw signals normalised to 0-100 (`scoring/normalise.py`)
2. Weighted composite: grid 35% · heat 25% · wildfire 20% · flood 10% · history 10%
3. Persona multiplier: ventilator 1.5x · oxygen 1.3x · dialysis 1.2x · wheelchair 1.1x
4. Backup modifier: no backup +30% · 12h+ backup -20%
5. Alert thresholds: 60 → advisory · 80 → escalation · 95 → critical

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `GCP_PROJECT_ID` | Backend | BigQuery project |
| `BQ_DATASET` | Backend | BigQuery dataset (default: `vitaguard`) |
| `GEMINI_API_KEY` | Backend + Frontend | Gemini 2.5 Flash (advisory, call scripts, chat) |
| `GOOGLE_MAPS_API_KEY` | Backend | Server-side geocoding for `/hazards` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Frontend (build arg) | Maps JS API for HazardMap |
| `NEXT_PUBLIC_API_URL` | Frontend (build arg) | Backend Cloud Run URL |
| `OPENWEATHERMAP_API_KEY` | Backend | Heat data (optional — falls back gracefully) |
| `NASA_FIRMS_MAP_KEY` | Backend | Wildfire hotspots (optional) |
| `AIRNOW_API_KEY` | Backend | AQI data (optional) |

GitHub Secrets (used in deploy.yml): `GCP_PROJECT_ID`, `GCP_CREDENTIALS`, `BACKEND_URL`, `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`

## Key Commands

```bash
# Run BigQuery setup
.venv/bin/python bigquery/create_tables.py --project=waybackhome-whvw1t598hcl0gkc6u
.venv/bin/python bigquery/seed_users.py --project=waybackhome-whvw1t598hcl0gkc6u

# Start API server
.venv/bin/uvicorn api.main:app --reload --port 8000

# Auth
gcloud auth application-default login

# Add a secret
gh secret set SECRET_NAME --body "value"
```

## Git & PR Workflow

**Never commit directly to `main`.** Always work on a feature branch and open a PR.

```bash
git checkout main && git pull
git checkout -b feat/your-feature-name

git push -u origin feat/your-feature-name
gh pr create --title "..." --body "..."
```

- Branch names: `feat/`, `fix/`, `chore/` prefixes
- Merging a PR to `main` triggers GitHub Actions to build Docker images and deploy both Cloud Run services
- After each PR is merged, start the next task on a **new branch from the updated main**

## Cloud Run / Cloud Build IAM (one-time setup)

| Service Account | Roles |
|---|---|
| `649300986983@cloudbuild.gserviceaccount.com` | `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`, `storage.admin`, `serviceusage.serviceUsageConsumer` |
| `649300986983-compute@developer.gserviceaccount.com` | same as above |
| `compass-deploy@waybackhome-whvw1t598hcl0gkc6u.iam.gserviceaccount.com` | `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`, `storage.admin`, `cloudbuild.builds.editor` |

## Conventions

- All BigQuery writes use `client.insert_rows_json()` (streaming insert)
- All ingestion clients are async (`asyncio` + `httpx`)
- Pydantic models live in `api/models/` and are reused in routes
- Static lookup data (flood zones, outage history, HFTD) lives in `files/` as JSON
- Never hardcode the project ID — read from `GCP_PROJECT_ID` env var
- Frontend API calls go through `frontend/caregiver-app/lib/api.ts`
- TypeScript types live in `frontend/caregiver-app/lib/types.ts` — keep in sync with Pydantic models
- `NEXT_PUBLIC_*` env vars must be passed as Docker build args (baked in at build time)
