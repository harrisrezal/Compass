# scoring/ — Claude Code Context

## Purpose

Converts raw ingestion signals into personalised risk scores (0-100) per user.
Called by the RocketRide `normalise` and `score-engine` pipeline nodes.

## Pipeline

```
ingestion outputs
      │
      ▼
normalise.py::normalise_all()     → {zip_code: {grid, heat, wildfire, flood, history, _raw...}}
      │
      ▼
composite.py::calculate_all_user_scores()  → fetches users from BQ, applies weights + multipliers
      │
      ▼
composite.py::check_and_trigger_alerts()   → filters scores >= 60, returns list for advisory pipeline
```

## Weights (from ARCHITECTURE.md)

| Signal | Weight | Normaliser |
|---|---|---|
| Grid stress | 35% | `normalise_grid(stress_pct)` |
| Heat index | 25% | `normalise_heat(heat_index_f)` |
| Wildfire/PSPS | 20% | `normalise_wildfire(has_red_flag, active_psps)` |
| Flood risk | 10% | `normalise_flood(fema_zone)` — from `files/zip_flood_lookup.json` |
| Historical | 10% | `normalise_history(outage_count, psps_count)` — from `files/zip_outage_history.json` |

## Persona multipliers

`ventilator 1.5x · oxygen 1.3x · dialysis 1.2x · wheelchair 1.1x · heat_vulnerable 1.0x`

Backup modifier: no backup → ×1.30 · minimal (<2h) → ×1.15 · strong (12h+) → ×0.80

## Static lookups

All in `files/` — loaded once at first call, cached in module globals:
- `zip_flood_lookup.json` → FEMA flood zone per ZIP
- `zip_outage_history.json` → historical outage count + psps_count per ZIP
- `zip_hftd_lookup.json` → CPUC HFTD tier per ZIP (available for future use)

## Alert thresholds

- `>= 60` → trigger advisory pipeline (Gemini action plan)
- `>= 80` → immediate escalation + caregiver alert
- `>= 95` → critical / emergency response

## Still needed

- `advisory.py` — Gemini Pro call to generate `action_plans` rows
- `vertex_client.py` — Vertex AI AutoML time-series boost (fills `vertex_ai_prediction` field)
