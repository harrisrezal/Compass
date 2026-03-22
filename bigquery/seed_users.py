"""
bigquery/seed_users.py

Inserts the 3 demo user profiles (Margaret, James, Dorothy) from
files/demo_users.json into vitaguard.user_profiles.

Usage:
    python bigquery/seed_users.py --project=YOUR_PROJECT_ID
    python bigquery/seed_users.py --project=YOUR_PROJECT_ID --dataset=vitaguard
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from google.cloud import bigquery

SEED_FILE = Path(__file__).parent.parent / "files" / "demo_users.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def prepare_row(user: dict) -> dict:
    """
    Massage a demo_users.json record into the exact shape BigQuery expects
    for vitaguard.user_profiles. Nested dicts become RECORD values; lists
    of dicts become REPEATED RECORD values — no transformation needed for
    those since insert_rows_json handles them natively.
    """
    row = dict(user)

    # Fill audit timestamps if absent
    now = _now_iso()
    row.setdefault("created_at", now)
    row.setdefault("updated_at", now)

    # nearest_resources field name alignment (schema uses pharmacy_name, seed uses pharmacy_name ✓)
    return row


def seed(project: str, dataset: str) -> None:
    with open(SEED_FILE) as fh:
        users = json.load(fh)

    rows = [prepare_row(u) for u in users]

    client = bigquery.Client(project=project)
    table_id = f"{project}.{dataset}.user_profiles"

    errors = client.insert_rows_json(table_id, rows)
    if errors:
        print("Insertion errors:")
        for e in errors:
            print(f"  {e}")
        raise RuntimeError("Seed failed — see errors above")

    print(f"Seeded {len(rows)} users into {table_id}:")
    for r in rows:
        print(f"  {r['user_id']}  {r['name']}  ({r['condition']})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo users into BigQuery")
    parser.add_argument("--project", required=True, help="GCP project ID")
    parser.add_argument("--dataset", default="vitaguard", help="BigQuery dataset name (default: vitaguard)")
    args = parser.parse_args()
    seed(args.project, args.dataset)


if __name__ == "__main__":
    main()
