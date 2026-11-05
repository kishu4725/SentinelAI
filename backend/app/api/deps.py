
"""
SentinelAI API Dependencies (JWT Authentication & Role Authorization)
"""

import hmac
from typing import Optional

from fastapi import (
    Depends,
    Header,
    HTTPException,
    status,
    Request,
)
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials,
)
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.core.config import settings
from backend.app.core.security import decode_access_token


# Register Bearer JWT authentication with FastAPI/OpenAPI.
bearer_scheme = HTTPBearer(auto_error=False)


def get_token_from_header(
    request: Request,
    authorization: Optional[str] = None,
) -> Optional[str]:
    """Extract a Bearer token from the Authorization header."""

    auth_header = (
        authorization
        or request.headers.get("Authorization")
        or request.headers.get("authorization")
    )

    if not auth_header:
        return None

    parts = auth_header.split()

    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]

    # Preserve compatibility with callers that pass a raw token.
    return auth_header


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> User:
    """Validate a JWT access token and return the authenticated user."""

    # Prefer the token parsed by FastAPI's Bearer scheme.
    token = credentials.credentials if credentials else None

    # Fall back to the request header if credentials weren't parsed.
    if not token:
        token = get_token_from_header(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)

    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username_or_email = payload["sub"]

    user = (
        db.query(User)
        .filter(
            (User.username == username_or_email)
            | (User.email == username_or_email)
        )
        .first()
    )

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Allow access only to users with the admin role."""

    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "SOC Admin authorization required to access "
                "command center endpoints"
            ),
        )

    return current_user


def require_sensor_key(
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
) -> str:
    """
    Authenticates honeypot / cloud sensors posting to /api/events/ingest.
    Fails closed: if SENTINEL_SENSOR_API_KEY is not configured, ingestion is disabled.
    """
    expected = settings.sensor_api_key()

    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sensor ingestion is disabled: SENTINEL_SENSOR_API_KEY is not configured on the server.",
        )

    if not x_api_key or not hmac.compare_digest(x_api_key.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing sensor API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    return x_api_key
