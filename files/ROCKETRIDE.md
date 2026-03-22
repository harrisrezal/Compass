# RocketRide Setup Guide — Compass

RocketRide is the AI pipeline orchestration layer for Compass. It runs inside VS Code and manages data ingestion and advisory generation without leaving your development environment.

## Installation

1. Install the RocketRide VS Code extension:
   - Open VS Code → Extensions → Search "RocketRide"
   - Extension ID: `RocketRide.rocketride`
   - Or: https://marketplace.visualstudio.com/items?itemName=RocketRide.rocketride

2. Install the Python SDK:
```bash
pip install rocketride
```

3. Start the RocketRide engine (runs on localhost:5565):
   - Click the RocketRide icon in the VS Code activity bar
   - Click "Start Engine"

## Compass Pipelines

### Pipeline 1 — Ingestion Pipeline
Pulls all 4 data sources, normalises, scores, writes to BigQuery.

```bash
# Trigger manually
python scripts/run_ingestion.py

# Or via SDK
import asyncio
from rocketride import RocketRideClient

async def run():
    async with RocketRideClient(uri="http://localhost:5565") as client:
        result = await client.use(filepath="pipeline/ingestion_pipeline.json")
        token = result["token"]
        response = await client.send(token, "run")
        print(response)

asyncio.run(run())
```

### Pipeline 2 — Advisory Pipeline
Triggered when a user's risk score crosses 60. Generates Gemini action plan and sends notifications.

```bash
# Trigger for a specific user
python scripts/run_advisory.py --user_id demo-user-margaret-001
```

## Visual Pipeline Builder

Open VS Code, click the RocketRide icon, and load `pipeline/ingestion_pipeline.json` to see the visual node graph. You can:
- Drag nodes to rearrange
- Click any node to see its config
- Watch data flow in real time during a run

## Docker Deployment

```bash
# Build the pipeline engine image
docker build -f docker/Dockerfile.engine -t compass-engine .

# Run on your server
docker run -p 5565:5565 compass-engine
```
