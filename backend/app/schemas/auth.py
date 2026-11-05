"""
Authentication Request & Response Pydantic Schemas
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str
    name: Optional[str] = "Sentinel User"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    name: Optional[str] = None
    email: Optional[str] = None
    security_score: int = 98


class VerifyOtpRequest(BaseModel):
    email: str
    otp_code: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp_code: str
    new_password: str


class SimulateEventRequest(BaseModel):
    event_type: str  # NORMAL_CHECK, BRUTE_FORCE, SIMULATED_MALWARE_UPLOAD, DATA_EXFILTRATION


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    name: str
    role: str
    security_score: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
