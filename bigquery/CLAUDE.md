# bigquery/ — Claude Code Context

## Purpose

Infrastructure scripts for the `vitaguard` BigQuery dataset.

## Files

| File | Usage |
|---|---|
| `create_tables.py` | Creates `vitaguard` dataset + all 8 tables. Idempotent (`exists_ok=True`). |
| `seed_users.py` | Streams 3 demo users from `files/demo_users.json` → `user_profiles`. |
| `schemas/*.json` | **Source of truth** for all table schemas. Do not modify without updating Pydantic models too. |

## Run

```bash
.venv/bin/python bigquery/create_tables.py --project=waybackhome-whvw1t598hcl0gkc6u [--dry-run]
.venv/bin/python bigquery/seed_users.py --project=waybackhome-whvw1t598hcl0gkc6u
```

## Schema files → tables

| Schema file | Table | Notes |
|---|---|---|
| `grid_stress.json` | `grid_stress` | Partitioned on `forecast_hour` |
| `weather_conditions.json` | `weather_conditions` | Partitioned on `forecast_hour`, clustered on `zip_code` |
| `hazard_alerts.json` | `hazard_alerts` | Partitioned on `ingested_at`, clustered on `alert_type` |
| `historical_outages.json` | `historical_outages` | Static reference table, no partition |
| `risk_scores.json` | `risk_scores` | Partitioned on `timestamp`, clustered on `user_id` |
| `user_profiles.json` | `user_profiles` | No partition (small lookup table) |
| `welfare_checks.json` | `welfare_checks` | Partitioned on `triggered_at`, clustered on `user_id` |
| `action_plans.json` | `action_plans` | Partitioned on `generated_at`, clustered on `user_id` |
