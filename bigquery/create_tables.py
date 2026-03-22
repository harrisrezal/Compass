"""
bigquery/create_tables.py

Creates the vitaguard BigQuery dataset and all 8 tables from the JSON schema
files in bigquery/schemas/.

Usage:
    python bigquery/create_tables.py --project=YOUR_PROJECT_ID
    python bigquery/create_tables.py --project=YOUR_PROJECT_ID --dry-run
    python bigquery/create_tables.py --project=YOUR_PROJECT_ID --dataset=vitaguard --location=us-central1
"""

import argparse
import json
import os
from pathlib import Path

from google.cloud import bigquery
from google.cloud.bigquery import SchemaField, TimePartitioning, TimePartitioningType

SCHEMAS_DIR = Path(__file__).parent / "schemas"

# Table configs: name → (schema_file, partition_field, clustering_fields)
TABLE_CONFIGS = {
    "grid_stress": ("grid_stress.json", "forecast_hour", []),
    "weather_conditions": ("weather_conditions.json", "forecast_hour", ["zip_code"]),
    "hazard_alerts": ("hazard_alerts.json", "ingested_at", ["alert_type"]),
    "historical_outages": ("historical_outages.json", None, []),
    "risk_scores": ("risk_scores.json", "timestamp", ["user_id"]),
    "user_profiles": ("user_profiles.json", None, []),
    "welfare_checks": ("welfare_checks.json", "triggered_at", ["user_id"]),
    "action_plans": ("action_plans.json", "generated_at", ["user_id"]),
}


def _build_schema(fields: list) -> list[SchemaField]:
    """Recursively convert JSON schema field defs to BigQuery SchemaField objects."""
    result = []
    for f in fields:
        sub_fields = _build_schema(f["fields"]) if f.get("fields") else ()
        result.append(
            SchemaField(
                name=f["name"],
                field_type=f["type"],
                mode=f.get("mode", "NULLABLE"),
                description=f.get("description", ""),
                fields=sub_fields,
            )
        )
    return result


def load_schema(schema_file: str) -> list[SchemaField]:
    path = SCHEMAS_DIR / schema_file
    with open(path) as fh:
        raw = json.load(fh)
    return _build_schema(raw)


def create_dataset(client: bigquery.Client, dataset_id: str, location: str, dry_run: bool) -> None:
    full_id = f"{client.project}.{dataset_id}"
    dataset = bigquery.Dataset(full_id)
    dataset.location = location
    dataset.description = "Compass — AI Medical Emergency Intelligence for California"
    if dry_run:
        print(f"[dry-run] Would create dataset: {full_id} (location={location})")
        return
    client.create_dataset(dataset, exists_ok=True)
    print(f"Dataset ready: {full_id}")


def create_table(
    client: bigquery.Client,
    dataset_id: str,
    table_name: str,
    schema: list[SchemaField],
    partition_field: str | None,
    clustering_fields: list[str],
    dry_run: bool,
) -> None:
    table_id = f"{client.project}.{dataset_id}.{table_name}"

    if dry_run:
        print(f"\n[dry-run] Would create table: {table_id}")
        print(f"  Partition on: {partition_field or 'none'}")
        print(f"  Cluster on:   {clustering_fields or 'none'}")
        print(f"  Fields ({len(schema)}):")
        for f in schema:
            nested = f" [{len(f.fields)} nested fields]" if f.fields else ""
            print(f"    {f.name} {f.field_type} ({f.mode}){nested}")
        return

    table = bigquery.Table(table_id, schema=schema)

    if partition_field:
        table.time_partitioning = TimePartitioning(
            type_=TimePartitioningType.DAY,
            field=partition_field,
        )

    if clustering_fields:
        table.clustering_fields = clustering_fields

    client.create_table(table, exists_ok=True)
    print(f"Table ready: {table_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create Compass BigQuery tables")
    parser.add_argument("--project", required=True, help="GCP project ID")
    parser.add_argument("--dataset", default="vitaguard", help="BigQuery dataset name (default: vitaguard)")
    parser.add_argument("--location", default="us-central1", help="Dataset location (default: us-central1)")
    parser.add_argument("--dry-run", action="store_true", help="Print schema without creating tables")
    args = parser.parse_args()

    client = bigquery.Client(project=args.project)

    create_dataset(client, args.dataset, args.location, args.dry_run)

    for table_name, (schema_file, partition_field, clustering_fields) in TABLE_CONFIGS.items():
        schema = load_schema(schema_file)
        create_table(
            client,
            args.dataset,
            table_name,
            schema,
            partition_field,
            clustering_fields,
            args.dry_run,
        )

    if args.dry_run:
        print("\n[dry-run] No tables were created.")
    else:
        print(f"\nAll {len(TABLE_CONFIGS)} tables ready in {args.project}.{args.dataset}")


if __name__ == "__main__":
    main()
