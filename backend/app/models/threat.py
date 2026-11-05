"""
Combined Threat Record SQLAlchemy Model
Merges Original Security Event + ML Prediction Contract + Cloud SOAR Response
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from backend.app.db.base import Base


class ThreatRecord(Base):
    __tablename__ = "threat_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_id = Column(String, unique=True, index=True, nullable=False)
    
    # Original Security Event fields
    source_ip = Column(String, nullable=False, default="127.0.0.1")
    source_country = Column(String, nullable=False, default="India")
    source_region = Column(String, nullable=False, default="Karnataka")
    source_city = Column(String, nullable=False, default="Mysuru")
    source_lat = Column(Float, nullable=False, default=12.2958)
    source_lng = Column(Float, nullable=False, default=76.6394)
    target_city = Column(String, nullable=False, default="Bengaluru")
    attack_type = Column(String, nullable=False, default="ANOMALY_DETECTION")
    user_id = Column(String, nullable=True)
    device = Column(String, nullable=True)
    browser = Column(String, nullable=True)

    # ML Result fields (Strict ML Contract: prediction, threat, anomaly_score, risk_score, risk_level)
    prediction = Column(Integer, nullable=False, default=1)      # -1 = Anomalous, 1 = Normal
    threat_status = Column(String, nullable=False, default="Normal") # "Anomalous" or "Normal"
    anomaly_score = Column(Float, nullable=False, default=0.0)    # e.g. -0.066645
    risk_score = Column(Float, nullable=False, default=0.0)       # 0.0 to 100.0
    risk_level = Column(String, nullable=False, default="Normal") # "Critical", "High", "Medium", "Low", "Normal"
    is_anomalous = Column(Boolean, nullable=False, default=False)

    # Cloud Response Engine result
    response_status = Column(String, nullable=False, default="MONITOR") # "MONITOR", "ALERTED", "BLOCKED_SIMULATED"
    policy_applied = Column(String, nullable=True)
    
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
