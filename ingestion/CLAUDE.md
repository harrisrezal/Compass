# ingestion/ — Claude Code Context

## Purpose

Fetches data from external APIs every 15 minutes and writes to BigQuery.
All clients are async (`asyncio` + `httpx`). No API keys required for NOAA/NWS.

## Files

| File | API | BQ Table | Key function |
|---|---|---|---|
| `caiso_client.py` | CAISO OASIS (XML) | `grid_stress` | `CAISOClient().fetch_grid_stress(hours_ahead=72)` |
| `noaa_client.py` | NWS api.weather.gov (JSON) | `weather_conditions` | `fetch_weather_all_zips(zip_codes)` |
| `calfire_client.py` | NWS alerts API (JSON) | `hazard_alerts` | `fetch_active_alerts()` |
| `bigquery_writer.py` | — | all tables | `write_batch(grid_data, weather_data, alert_data, risk_scores)` |

## Return shape

Every client returns `list[dict]` rows shaped for the corresponding BigQuery table schema in `bigquery/schemas/`.

## ZIP coverage

Demo ZIPs: `93720` (Fresno/Margaret), `95969` (Paradise/James), `90034` (LA/Dorothy)
Full set in `noaa_client.ZIP_COORDS`.

## Notes

- CAISO OASIS returns XML — parsed with `xml.etree.ElementTree`
- `capacity_mw` is not directly available from CAISO SLD_FCST — left as `None`, `stress_pct` computed downstream
- CAL FIRE has no public PSPS API — Red Flag Warnings sourced from NWS alerts
- NWS zone codes (e.g. `CAZ015`) stored in `hazard_alerts.zip_codes_affected` — cross-referenced in scoring
