"""
api/main.py

Compass FastAPI application entry point.

Endpoints:
    POST /users           — onboard a new user
    GET  /scores/{user_id} — latest risk score
    GET  /plans/{user_id}  — latest action plan
    POST /welfare/check    — trigger a welfare check

Run:
    uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # load GCP_PROJECT_ID etc. from .env

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import hazards, plans, scores, users, welfare

app = FastAPI(
    title="Compass API",
    description="AI Medical Emergency Intelligence for California — risk scores and action plans",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(scores.router)
app.include_router(plans.router)
app.include_router(welfare.router)
app.include_router(hazards.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "compass-api"}
