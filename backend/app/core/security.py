"""
SentinelAI Core Security Helpers (Password Hashing & JWT Management)
"""

import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from backend.app.core.config import settings


import bcrypt


def hash_password(password: str) -> str:
    """Hashes password securely using standard bcrypt."""
    pw_bytes = password[:72].encode("utf-8")
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plain password against bcrypt hashed password (with legacy fallback)."""
    if not hashed_password or not plain_password:
        return False
    pw_bytes = plain_password[:72].encode("utf-8")
    try:
        if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
            return bcrypt.checkpw(pw_bytes, hashed_password.encode("utf-8"))
    except Exception:
        pass
    salt = os.getenv("PASSWORD_SALT", "sentinelai_salt_2026")
    sha_hash = hashlib.sha256((plain_password + salt).encode("utf-8")).hexdigest()
    return sha_hash == hashed_password


def create_access_token(subject: str, role: str = "user", expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return None
