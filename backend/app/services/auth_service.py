"""
Authentication & Default Seed User Initialization Service
"""

from sqlalchemy.orm import Session
from backend.app.models.user import User
from backend.app.core.security import hash_password, verify_password, create_access_token


import logging
import os

logger = logging.getLogger("SentinelAI.AuthService")


def _resolve_admin_password() -> str:
    admin_pass = os.getenv("SOC_ADMIN_PASSWORD")
    if admin_pass:
        return admin_pass
    if os.getenv("SENTINEL_ENV", "development").strip().lower() in {"production", "prod"}:
        raise RuntimeError("SOC_ADMIN_PASSWORD must be set when SENTINEL_ENV=production.")
    logger.warning(
        "SOC_ADMIN_PASSWORD is not set: the admin account uses the well-known development password. "
        "Set SOC_ADMIN_PASSWORD in .env before exposing this backend."
    )
    return "AdminSecure2026!"


def seed_default_users_if_empty(db: Session):
    """Ensures default user and Admin user exist in database with bcrypt hashed passwords."""
    admin_pass = _resolve_admin_password()
    admin_email = "projectcore444@gmail.com"

    if db.query(User).count() == 0:
        default_user = User(
            email="alex.morgan@example.com",
            username="alex_sentinel",
            hashed_password=hash_password("Password123!"),
            name="Alex Morgan",
            role="user",
            security_score=98,
            is_active=True
        )
        admin_user = User(
            email=admin_email,
            username="admin",
            hashed_password=hash_password(admin_pass),
            name="SOC Administrator",
            role="admin",
            security_score=100,
            is_active=True
        )
        db.add(default_user)
        db.add(admin_user)
        db.commit()
    else:
        # Guarantee permanent SOC admin user exists with active admin role & projectcore444@gmail.com
        admin_user = db.query(User).filter(
            (User.email == admin_email) | (User.username == admin_email) | (User.username == "admin")
        ).first()

        if not admin_user:
            admin_user = User(
                email=admin_email,
                username="admin",
                hashed_password=hash_password(admin_pass),
                name="SOC Administrator",
                role="admin",
                security_score=100,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
        else:
            admin_user.email = admin_email
            admin_user.role = "admin"
            admin_user.hashed_password = hash_password(admin_pass)
            db.commit()



def authenticate_user(db: Session, username_or_email: str, plain_pass: str):
    """Authenticates a user by username or email."""
    user = db.query(User).filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()
    
    if not user:
        return None
    if not verify_password(plain_pass, user.hashed_password):
        return None
    return user
