# Compass — Technical Architecture

## System Overview

```
External APIs (CAISO, NOAA, CAL FIRE, FEMA)
        │
        ▼
RocketRide Ingestion Pipeline (VS Code)
        │  Runs every 15 min via Cloud Scheduler
        ▼
Google BigQuery
├── vitaguard.grid_stress
├── vitaguard.weather_conditions
├── vitaguard.hazard_alerts
└── vitaguard.historical_outages (static reference)
        │
        ▼
Scoring Engine (Python)
├── normalise.py — signals → 0-100
├── weights.py  — persona multipliers
└── composite.py — weighted composite score
        │
        ├──► Vertex AI AutoML (time-series forecast boost)
        │
        ▼
Risk Score (0-100) per user
        │
        ├── score < 60: store, no alert
        ├── score 60-80: push notification + preventive plan
        └── score > 80: immediate escalation + caregiver alert
        │
        ▼
RocketRide Advisory Pipeline
        │
        ▼
Gemini Pro (action plan generation)
        │
        ▼
FastAPI Backend
├── GET  /scores/{user_id}
├── GET  /plans/{user_id}
├── POST /users (onboarding)
└── POST /welfare/check
        │
        ▼
React Frontend
├── Patient app (risk dashboard + action plan)
├── Caregiver app (live status + alerts)
└── Case worker dashboard (caseload view)
```

## Data Flow — Every 15 Minutes

1. Cloud Scheduler triggers RocketRide ingestion pipeline
2. CAISO node fetches grid load forecast + real-time supply mix
3. NOAA node fetches hourly weather for all monitored ZIPs
4. CAL FIRE node checks for active PSPS events + Red Flag Warnings
5. Normalise node converts all signals to 0-100 scale
6. Composite node runs weighted scoring for each enrolled user
7. BigQuery write node stores all raw signals + scores
8. Alert check node triggers advisory pipeline for any score > 60

## Scoring Weights

| Signal | Weight | Rationale |
|---|---|---|
| Grid stress | 35% | Most direct cause of equipment failure |
| Heat index | 25% | Second highest cause of medical emergency |
| Wildfire/PSPS | 20% | Direct evacuation + power loss risk |
| Flood risk | 10% | Relevant in CA, less frequent |
| Historical risk | 10% | ZIP-level baseline modifier |

## Persona Multipliers

| Condition | Multiplier | Reason |
|---|---|---|
| Ventilator | 1.5x | Minutes to crisis without power |
| Oxygen | 1.3x | Hours to crisis, very common |
| Dialysis | 1.2x | 48-72hr crisis window |
| Wheelchair | 1.1x | Mobility loss risk |
| Heat vulnerable | 1.0x base | Volume play — largest segment |
| No backup power | +30% | Amplifies all risk |
| Strong backup (12hrs+) | -20% | Reduces urgency |
