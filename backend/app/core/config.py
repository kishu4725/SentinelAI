"""
SentinelAI Backend Configuration Settings
"""

import logging
import os
import secrets
from pathlib import Path
from typing import List

# Automatically load .env file if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
except ImportError:
    pass

logger = logging.getLogger("SentinelAI.Config")

# Values that must never be accepted as a real signing key.
_KNOWN_BAD_SECRETS = {"", "change-me", "changeme", "sentinelai_super_secret_jwt_key_2026"}


def _is_production() -> bool:
    return os.getenv("SENTINEL_ENV", "development").strip().lower() in {"production", "prod"}


def _resolve_secret_key() -> str:
    """
    Returns the JWT signing key from SECRET_KEY.
    - Production: refuses to start without a real key.
    - Development: falls back to a random per-process key (no hardcoded secret in source);
      logins are invalidated on every restart until SECRET_KEY is set in .env.
    """
    value = os.getenv("SECRET_KEY", "").strip()
    if value not in _KNOWN_BAD_SECRETS:
        return value
    if _is_production():
        raise RuntimeError(
            "SECRET_KEY is missing or insecure. Set a strong random SECRET_KEY "
            "(e.g. python -c \"import secrets; print(secrets.token_urlsafe(48))\") "
            "when SENTINEL_ENV=production."
        )
    logger.warning(
        "SECRET_KEY is not set (or is a known default). Using a random per-process key; "
        "all logins will be invalidated on restart. Set SECRET_KEY in .env."
    )
    return secrets.token_urlsafe(48)


def _resolve_cors_origins() -> List[str]:
    raw = os.getenv("SENTINEL_CORS_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ]


class Settings:

    PROJECT_NAME: str = "SentinelAI Backend Core API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    SECRET_KEY: str = _resolve_secret_key()
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database URL. Use PostgreSQL, or SQLite for a zero-install local run, e.g.
    #   DATABASE_URL=sqlite:///./database/sentinelai.db
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://<username>:<password>@localhost:5433/sentinelai_db"
    )

    # CORS origins (override with SENTINEL_CORS_ORIGINS="https://a.example,https://b.example")
    CORS_ORIGINS: List[str] = _resolve_cors_origins()

    # SMTP Email Configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "noreply@sentinelai.io")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "True").lower() in ("true", "1", "t")
    SMTP_SSL: bool = os.getenv("SMTP_SSL", "False").lower() in ("true", "1", "t")

    # ---- Read at request time (not import time) so they can be changed without a reload ----
    @staticmethod
    def sensor_api_key() -> str:
        """Shared secret honeypot/cloud sensors must send in the X-API-Key header."""
        return os.getenv("SENTINEL_SENSOR_API_KEY", "").strip()

    @staticmethod
    def trust_client_risk_score() -> bool:
        """
        DEMO/TEST ONLY. When true, a sensor-supplied details.risk_score overrides the ML score.
        Default false: the server always computes the risk score itself.
        """
        return os.getenv("SENTINEL_TRUST_CLIENT_RISK_SCORE", "false").strip().lower() in ("1", "true", "yes", "on")


settings = Settings()
