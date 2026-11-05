"""
Telemetry & Attack Map Aggregation Service
"""

from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.models.threat import ThreatRecord
from backend.app.models.event import SecurityEvent


def seed_initial_threats_if_empty(db: Session):
    """Populates baseline threat records for initial SOC attack map dashboard loading."""
    if db.query(ThreatRecord).count() == 0:
        sample_threats = [
            ThreatRecord(
                event_id="EVT-SEED-01",
                source_ip="192.168.1.45",
                source_country="India",
                source_region="Karnataka",
                source_city="Mysuru",
                source_lat=12.2958,
                source_lng=76.6394,
                target_city="Bengaluru",
                attack_type="HTTP_BRUTE_FORCE",
                risk_score=99.05,
                risk_level="Critical",
                prediction=-1,
                threat_status="Anomalous",
                anomaly_score=-0.066645,
                is_anomalous=True,
                response_status="BLOCKED_SIMULATED",
                policy_applied="Critical Threat Blocklist (Dry-Run)"
            ),
            ThreatRecord(
                event_id="EVT-SEED-02",
                source_ip="198.51.100.99",
                source_country="Germany",
                source_region="Hesse",
                source_city="Frankfurt",
                source_lat=50.1109,
                source_lng=8.6821,
                target_city="Bengaluru",
                attack_type="SSH_PROBE",
                risk_score=85.00,
                risk_level="High",
                prediction=-1,
                threat_status="Anomalous",
                anomaly_score=-0.041200,
                is_anomalous=True,
                response_status="BLOCKED_SIMULATED",
                policy_applied="Critical Threat Blocklist (Dry-Run)"
            ),
            ThreatRecord(
                event_id="EVT-SEED-03",
                source_ip="198.51.100.12",
                source_country="United States",
                source_region="California",
                source_city="San Francisco",
                source_lat=37.7749,
                source_lng=-122.4194,
                target_city="Bengaluru",
                attack_type="RAPID_RESOURCE_ACCESS",
                risk_score=55.00,
                risk_level="Medium",
                prediction=1,
                threat_status="Normal",
                anomaly_score=-0.015000,
                is_anomalous=False,
                response_status="ALERTED",
                policy_applied="Suspicious Behavior Alerting"
            )
        ]
        db.add_all(sample_threats)
        db.commit()


def get_soc_metrics(db: Session) -> Dict[str, int]:
    """Calculates global threat telemetry metrics."""
    total = db.query(ThreatRecord).count()
    countries = db.query(ThreatRecord.source_country).distinct().count()
    high_risk = db.query(ThreatRecord).filter(ThreatRecord.risk_score >= 75.0).count()
    blocked = db.query(ThreatRecord).filter(ThreatRecord.response_status.like("%BLOCK%")).count()

    return {
        "activeCount": total,
        "uniqueCountries": max(countries, 1),
        "highRiskCount": high_risk,
        "blockedCount": blocked,
    }
