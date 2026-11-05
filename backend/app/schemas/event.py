"""
Event Ingestion & User Portal Security Schemas
"""

from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict


class EventIngestRequest(BaseModel):
    event_type: str  # LOGIN_SUCCESS, FILE_UPLOAD, LOGIN_FAILED, etc.
    user_id: Optional[str] = "alex_sentinel"
    source_ip: Optional[str] = "192.168.1.45"
    device: Optional[str] = "Windows PC"
    browser: Optional[str] = "Chrome 128"
    location: Optional[str] = "Mysuru, India"
    source_country: Optional[str] = "India"
    source_region: Optional[str] = "Karnataka"
    source_city: Optional[str] = "Mysuru"
    source_lat: Optional[float] = 12.2958
    source_lng: Optional[float] = 76.6394
    target_city: Optional[str] = "Bengaluru"
    details: Optional[Dict] = {}


class SecurityEventOut(BaseModel):
    id: int
    event_id: str
    event_type: str
    user_id: Optional[str]
    source_ip: str
    device: str
    browser: str
    location: str
    status: str
    risk_score: float
    risk_level: str
    timestamp: str

    model_config = ConfigDict(from_attributes=True)


class UserSecurityStatusOut(BaseModel):
    securityScore: int
    statusText: str
    statusBadge: str
    statusColor: str
    alertCount: int
    alertBannerMessage: str
    isSuspicious: bool
    activitySummary: Dict
    sessions: List[Dict]
