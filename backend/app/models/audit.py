"""
SOAR Audit Trail SQLAlchemy Model (Database Mirror of cloud/audit_logs.jsonl)
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from backend.app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    log_id = Column(String, index=True, nullable=False)
    timestamp = Column(String, nullable=False)
    event_id = Column(String, index=True, nullable=False)
    source_ip = Column(String, nullable=False)
    risk_score = Column(Float, nullable=False)
    action = Column(String, nullable=False)  # MONITOR, ALERT, BLOCK
    policy_applied = Column(String, nullable=False)
    dry_run = Column(Boolean, nullable=False, default=True)
    summary = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
