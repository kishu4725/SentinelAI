"""
SentinelAI FastAPI Core Backend Entrypoint
Orchestrates User Security Portal, SOC Command Center, ML Contract, and Cloud SOAR Engine.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.db.base import Base
from backend.app.db.session import engine, SessionLocal
from backend.app.services.auth_service import seed_default_users_if_empty
from backend.app.services.telemetry_service import seed_initial_threats_if_empty
from backend.app.services.ml_service import MLService
from backend.app.api.router import api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SentinelAI.Backend")

# Advertise Bearer JWT authentication in the OpenAPI documentation.
bearer_scheme = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle handler for DB initialization and seeding."""
    logger.info("Initializing SentinelAI Database Tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_default_users_if_empty(db)
        seed_initial_threats_if_empty(db)
    finally:
        db.close()

    ml_status = MLService.model_status()
    if ml_status["loaded"]:
        logger.info(f"ML model loaded: {ml_status['model_version']} ({ml_status['mode']}).")
    else:
        logger.warning(
            "ML MODEL NOT LOADED - scoring is RULES-ONLY. Reason: %s", ml_status["reason"]
        )

    if not settings.sensor_api_key():
        logger.warning(
            "SENTINEL_SENSOR_API_KEY is not set: /api/events/ingest will reject all sensors (503)."
        )

    logger.info("SentinelAI Backend Core API is Online!")
    yield
    logger.info("Shutting down SentinelAI Backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["Health Check"])
def root_health_check():
    """Root Health Check Endpoint."""
    return {
        "status": "online",
        "system": "SentinelAI Cloud Threat Intelligence Backend",
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "OK",
    }


@app.get(f"{settings.API_PREFIX}/health", tags=["Health Check"])
def detailed_health_check():
    """Reports database connectivity and whether the ML model is actually in use."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        database = "ok"
    except Exception as err:  # class name only: never leak connection strings
        database = f"error: {type(err).__name__}"

    ml_status = MLService.model_status()
    healthy = database == "ok" and ml_status["loaded"]
    return {
        "status": "ok" if healthy else "degraded",
        "version": settings.VERSION,
        "database": database,
        "ml_model": ml_status,
        "sensor_ingestion_configured": bool(settings.sensor_api_key()),
    }
