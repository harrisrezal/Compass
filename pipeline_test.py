"""
pipeline_test.py

End-to-end ingestion + scoring pipeline test.

Runs the full cycle:
  1. Fetch CAISO grid stress
  2. Fetch NOAA weather for demo ZIPs
  3. Fetch CAL FIRE / NWS hazard alerts
  4. Normalise all signals
  5. Score all 3 demo users
  6. Write everything to BigQuery
  7. Print a summary table

Usage:
    .venv/bin/python pipeline_test.py
    .venv/bin/python pipeline_test.py --no-write   # skip BQ write (dry run)
"""

from __future__ import annotations

import argparse
import asyncio
from dotenv import load_dotenv

load_dotenv()

from ingestion.caiso_client import CAISOClient
from ingestion.noaa_client import fetch_weather_all_zips
from ingestion.calfire_client import fetch_active_alerts
from ingestion.bigquery_writer import write_batch
from scoring.normalise import normalise_all
from scoring.composite import calculate_all_user_scores, check_and_trigger_alerts

DEMO_ZIPS = ["93720", "93722", "95969", "90034", "92103"]


async def run(write_to_bq: bool = True) -> None:
    print("=" * 60)
    print("COMPASS — Pipeline Test")
    print("=" * 60)

    # Step 1: Fetch grid stress
    print("\n[1/6] Fetching CAISO grid stress...")
    try:
        grid_data = await CAISOClient().fetch_grid_stress(hours_ahead=24)
        print(f"      {len(grid_data)} grid rows fetched")
        if grid_data:
            sample = grid_data[0]
            print(f"      Sample: forecast_hour={sample.get('forecast_hour')} load_mw={sample.get('load_mw')}")
    except Exception as e:
        print(f"      WARNING: CAISO fetch failed ({e}) — using empty data")
        grid_data = []

    # Step 2: Fetch weather
    print(f"\n[2/6] Fetching NOAA weather for ZIPs {DEMO_ZIPS}...")
    try:
        weather_data = await fetch_weather_all_zips(DEMO_ZIPS)
        zips_covered = {r["zip_code"] for r in weather_data}
        print(f"      {len(weather_data)} weather rows across ZIPs: {zips_covered}")
        if weather_data:
            sample = weather_data[0]
            print(f"      Sample: zip={sample.get('zip_code')} temp_f={sample.get('temp_f')} heat_index_f={sample.get('heat_index_f')}")
    except Exception as e:
        print(f"      WARNING: NOAA fetch failed ({e}) — using empty data")
        weather_data = []

    # Step 3: Fetch alerts
    print("\n[3/6] Fetching CAL FIRE / NWS hazard alerts...")
    try:
        alert_data = await fetch_active_alerts()
        print(f"      {len(alert_data)} active alerts")
        for a in alert_data[:3]:
            print(f"      {a.get('alert_type')} — {a.get('severity')} — active={a.get('active')}")
    except Exception as e:
        print(f"      WARNING: Alert fetch failed ({e}) — using empty data")
        alert_data = []

    # Step 4: Normalise
    print("\n[4/6] Normalising signals...")
    normalised = normalise_all(grid_data, weather_data, alert_data)
    print(f"      Signals normalised for {len(normalised)} ZIPs: {list(normalised.keys())}")
    for zip_code, sigs in normalised.items():
        print(f"      {zip_code}: grid={sigs['grid']:.0f} heat={sigs['heat']:.0f} wildfire={sigs['wildfire']:.0f}")

    # Step 5: Score users
    print("\n[5/6] Scoring demo users...")
    if not normalised:
        print("      No normalised signals — cannot score (check NOAA/CAISO fetch)")
        return
    scores = calculate_all_user_scores(normalised)

    print("\n  ┌─────────────────────────────────────────────────────────────┐")
    print("  │ USER                    SCORE   LEVEL      PRIMARY THREAT   │")
    print("  ├─────────────────────────────────────────────────────────────┤")
    for s in scores:
        uid = s["user_id"].replace("demo-user-", "").replace("-00", "#")
        score = s["composite_score"]
        level = s["risk_level"]
        threat = s.get("primary_threat", "none")
        print(f"  │ {uid:<24} {score:>5.1f}   {level:<10} {threat:<16} │")
    print("  └─────────────────────────────────────────────────────────────┘")

    # Step 6: Check alerts
    triggered = check_and_trigger_alerts(scores)
    print(f"\n      {len(triggered)} user(s) above alert threshold → advisory pipeline would trigger")

    # Step 7: Write to BQ
    if write_to_bq:
        print("\n[6/6] Writing to BigQuery...")
        write_batch(
            grid_data=grid_data,
            weather_data=weather_data,
            alert_data=alert_data,
            risk_scores=scores,
        )
        print("      Done.")
    else:
        print("\n[6/6] Skipping BigQuery write (--no-write)")

    print("\n" + "=" * 60)
    print("Pipeline test complete.")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compass end-to-end pipeline test")
    parser.add_argument("--no-write", action="store_true", help="Skip BigQuery write")
    args = parser.parse_args()
    asyncio.run(run(write_to_bq=not args.no_write))


if __name__ == "__main__":
    main()
