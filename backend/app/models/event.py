"""
Security Event Ingestion & Activity Log SQLAlchemy Model
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from backend.app.db.base import Base


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_id = Column(String, unique=True, index=True, nullable=False)
    event_type = Column(String, nullable=False)  # e.g. LOGIN_SUCCESS, FILE_UPLOAD, LOGIN_FAILED
    user_id = Column(String, nullable=True)
    source_ip = Column(String, nullable=False, default="127.0.0.1")
    device = Column(String, nullable=False, default="Windows PC")
    browser = Column(String, nullable=False, default="Chrome 128")
    location = Column(String, nullable=False, default="Mysuru, India")
    status = Column(String, nullable=False, default="Success")  # Success, Blocked, Completed
    risk_score = Column(Float, nullable=False, default=0.0)
    risk_level = Column(String, nullable=False, default="Normal")  # Normal, Secure, Medium, High, Critical
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
