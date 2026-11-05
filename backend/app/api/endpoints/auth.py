
import random
import time
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.models.event import SecurityEvent
from backend.app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
    VerifyOtpRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from backend.app.schemas.event import EventIngestRequest
from backend.app.core.security import hash_password, create_access_token
from backend.app.services.auth_service import authenticate_user
from backend.app.services.email_service import send_otp_email
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

# In-memory OTP storage (email -> data with expiry)
PENDING_REGISTRATIONS: Dict[str, Dict[str, Any]] = {}
RECOVERY_OTPS: Dict[str, Dict[str, Any]] = {}


def _client_ip(http_request: Request) -> str:
    """Use the direct client address; do not trust arbitrary forwarded headers."""
    if http_request.client:
        return http_request.client.host
    return "0.0.0.0"


def _failed_principal_key(username_or_email: str) -> str:
    """Avoid placing an unverified username or email directly in failed-login logs."""
    normalized = username_or_email.strip().casefold()
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]
    return f"failed_principal_{digest}"


def _record_auth_telemetry(
    db: Session,
    http_request: Request,
    event_type: str,
    user_id: str,
    failed_count: int = 0,
) -> None:
    """
    Send an authentication event through SentinelAI's existing
    ML -> threat -> audit -> WebSocket pipeline.

    Telemetry errors must not change the authentication response.
    Never pass passwords or OTP codes into telemetry.
    """
    try:
        # Local import avoids an import-time circular dependency between endpoints.
        from backend.app.api.endpoints.events import ingest_security_event

        client_ip = _client_ip(http_request)
        user_agent = http_request.headers.get("user-agent", "Unknown")[:200]

        event_request = EventIngestRequest(
            event_type=event_type,
            user_id=user_id,
            source_ip=client_ip,
            device="Browser",
            browser=user_agent,
            location=None,
            source_city=None,
            source_country=None,
            source_region=None,
            source_lat=None,
            source_lng=None,
            details={
                "source": "authentication",
                "failed_count": failed_count,
                "observed_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        ingest_security_event(event_request, db)

    except Exception:
        db.rollback()
        logger.exception(
            "Failed to record authentication telemetry for event type %s",
            event_type,
        )


def _recent_failed_count(
    db: Session,
    http_request: Request,
    principal_key: str,
) -> int:
    """Count recent failed attempts for this client IP and hashed principal."""
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)

        return (
            db.query(SecurityEvent)
            .filter(
                SecurityEvent.event_type == "LOGIN_FAILED",
                SecurityEvent.source_ip == _client_ip(http_request),
                SecurityEvent.user_id == principal_key,
                SecurityEvent.timestamp >= cutoff,
            )
            .count()
        )
    except Exception:
        logger.exception("Could not count recent failed login attempts")
        return 0


@router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    """Authenticate a user and record the login attempt."""
    user = authenticate_user(db, request.username, request.password)

    if not user:
        # Never log the submitted password or store the raw unverified identifier.
        principal_key = _failed_principal_key(request.username)
        previous_failures = _recent_failed_count(
            db, http_request, principal_key
        )

        _record_auth_telemetry(
            db=db,
            http_request=http_request,
            event_type="LOGIN_FAILED",
            user_id=principal_key,
            failed_count=previous_failures + 1,
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password",
        )

    _record_auth_telemetry(
        db=db,
        http_request=http_request,
        event_type="LOGIN_SUCCESS",
        user_id=user.username,
        failed_count=0,
    )

    token = create_access_token(subject=user.username, role=user.role)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        name=user.name,
        email=user.email,
        security_score=user.security_score,
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's database identity."""
    return current_user


@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a pending account and sends a six-digit OTP by email.
    The OTP is never returned in the HTTP response.
    """
    existing_user = db.query(User).filter(
        (User.username == request.username)
        | (User.email == request.email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email is already registered",
        )

    email_key = request.email.lower()
    otp_code = f"{random.randint(100000, 999999)}"

    PENDING_REGISTRATIONS[email_key] = {
        "email": email_key,
        "username": request.username,
        "password": request.password,
        "name": request.name or request.username,
        "otp": otp_code,
        "expires_at": time.time() + 600,
    }

    email_sent = send_otp_email(
        email_key, otp_code, purpose="registration"
    )

    if not email_sent:
        PENDING_REGISTRATIONS.pop(email_key, None)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Failed to deliver verification OTP email via SMTP. "
                "Registration aborted. Please try again."
            ),
        )

    return {
        "status": "verification_required",
        "email": request.email,
        "message": (
            f"A 6-digit verification OTP code has been dispatched "
            f"to {request.email}."
        ),
    }


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(request: VerifyOtpRequest, db: Session = Depends(get_db)):
    """Verify the registration OTP, create the account, and return a token."""
    email_key = request.email.lower()
    pending = PENDING_REGISTRATIONS.get(email_key)

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending registration request found for this email address.",
        )

    if time.time() > pending["expires_at"]:
        PENDING_REGISTRATIONS.pop(email_key, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification OTP code has expired. Please register again.",
        )

    if request.otp_code != pending["otp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification OTP code.",
        )

    new_user = User(
        email=email_key,
        username=pending["username"],
        hashed_password=hash_password(pending["password"]),
        name=pending["name"],
        role="user",
        security_score=98,
        is_active=True,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account creation failed. Please try again.",
        )

    PENDING_REGISTRATIONS.pop(email_key, None)

    access_token = create_access_token(
        subject=new_user.username,
        role=new_user.role,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=new_user.role,
        username=new_user.username,
        name=new_user.name,
        email=new_user.email,
        security_score=new_user.security_score,
    )


@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Send a recovery OTP to a registered email address."""
    email_key = request.email.lower()
    user = db.query(User).filter(User.email.ilike(email_key)).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered account found with this email address.",
        )

    otp_code = f"{random.randint(100000, 999999)}"
    RECOVERY_OTPS[email_key] = {
        "otp": otp_code,
        "expires_at": time.time() + 600,
    }

    email_sent = send_otp_email(
        email_key, otp_code, purpose="password_recovery"
    )

    if not email_sent:
        RECOVERY_OTPS.pop(email_key, None)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Failed to deliver recovery OTP email via SMTP. "
                "Please try again later."
            ),
        )

    return {
        "status": "recovery_otp_sent",
        "email": request.email,
        "message": (
            f"A 6-digit recovery OTP code has been dispatched "
            f"to {request.email}."
        ),
    }


@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Verify the recovery OTP and update the user's password."""
    email_key = request.email.lower()
    user = db.query(User).filter(User.email.ilike(email_key)).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered account found with this email address.",
        )

    recovery = RECOVERY_OTPS.get(email_key)

    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password recovery request found for this email address.",
        )

    if time.time() > recovery["expires_at"]:
        RECOVERY_OTPS.pop(email_key, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recovery OTP code has expired. Please request password reset again.",
        )

    if request.otp_code != recovery["otp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid recovery OTP code.",
        )

    user.hashed_password = hash_password(request.new_password)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed. Please try again.",
        )

    RECOVERY_OTPS.pop(email_key, None)

    return {
        "message": "Password reset successfully. Please sign in with your new password."
    }
