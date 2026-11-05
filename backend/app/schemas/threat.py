"""
SOC Dashboard & Threat Telemetry Pydantic Schemas
"""

from typing import List, Dict, Optional
from pydantic import BaseModel, ConfigDict


class ThreatRecordOut(BaseModel):
    id: int
    event_id: str
    source_ip: str
    source_country: str
    source_region: str
    source_city: str
    source_lat: float
    source_lng: float
    target_city: str
    attack_type: str
    risk_score: float
    risk_level: str
    prediction: int
    threat_status: str
    anomaly_score: float
    is_anomalous: bool
    response_status: str
    timestamp: str

    model_config = ConfigDict(from_attributes=True)


class SOCMetricsOut(BaseModel):
    activeCount: int
    uniqueCountries: int
    highRiskCount: int
    blockedCount: int


class CombinedThreatIngestResponse(BaseModel):
    message: str
    original_event: Dict
    ml_result: Dict
    threat_record: ThreatRecordOut
    audit_log: Dict
