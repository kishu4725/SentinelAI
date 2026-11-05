
"""
SOC Command Center Endpoints (/api/soc)
Supporting admin-frontend Port 5174
"""

from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.threat import ThreatRecord
from backend.app.models.audit import AuditLog
from backend.app.schemas.threat import ThreatRecordOut, SOCMetricsOut
from backend.app.services.telemetry_service import get_soc_metrics
from backend.app.models.user import User
from backend.app.api.deps import get_current_admin


router = APIRouter(prefix="/soc", tags=["SOC Command Center"])


# ==========================================
# SOC METRICS
# ==========================================

@router.get("/metrics", response_model=SOCMetricsOut)
def get_soc_summary_metrics(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Return global threat telemetry overview metrics for SOC Header."""
    metrics = get_soc_metrics(db)
    return SOCMetricsOut(**metrics)


# ==========================================
# THREAT FEED
# ==========================================

@router.get("/threats", response_model=List[ThreatRecordOut])
def get_soc_threat_feed(
    timeframe: str = Query(
        "24h",
        pattern="^(5m|15m|1h|24h|7d|30d)$",
    ),
    severity: str = Query("ALL"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Return threat records filtered by timeframe and severity.

    Supported timeframes:
    5m, 15m, 1h, 24h, 7d, 30d
    """

    now = datetime.now(timezone.utc)

    timeframe_durations = {
        "5m": timedelta(minutes=5),
        "15m": timedelta(minutes=15),
        "1h": timedelta(hours=1),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }

    cutoff = now - timeframe_durations[timeframe]

    query = db.query(ThreatRecord)

    # Filter threats by the selected time window.
    query = query.filter(ThreatRecord.timestamp >= cutoff)

    # Apply severity filtering when requested.
    if severity.upper() != "ALL":
        query = query.filter(
            ThreatRecord.risk_level.ilike(severity)
        )

    threats = (
        query
        .order_by(ThreatRecord.timestamp.desc())
        .limit(limit)
        .all()
    )

    results = []

    for threat in threats:
        results.append(
            ThreatRecordOut(
                id=threat.id,
                event_id=threat.event_id,
                source_ip=threat.source_ip,
                source_country=threat.source_country,
                source_region=threat.source_region,
                source_city=threat.source_city,
                source_lat=threat.source_lat,
                source_lng=threat.source_lng,
                target_city=threat.target_city,
                attack_type=threat.attack_type,
                risk_score=threat.risk_score,
                risk_level=threat.risk_level,
                prediction=threat.prediction,
                threat_status=threat.threat_status,
                anomaly_score=threat.anomaly_score,
                is_anomalous=threat.is_anomalous,
                response_status=threat.response_status,
                timestamp=(
                    threat.timestamp.isoformat()
                    if threat.timestamp
                    else ""
                ),
            )
        )

    return results


# ==========================================
# ATTACK MAP
# ==========================================

@router.get("/attack-map")
def get_soc_attack_map_telemetry(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Return threat nodes and arc vectors for the Leaflet AttackMap.
    """

    threats = (
        db.query(ThreatRecord)
        .order_by(ThreatRecord.id.desc())
        .limit(20)
        .all()
    )

    nodes = []

    for threat in threats:
        nodes.append(
            {
                "id": threat.event_id,
                "sourceIp": threat.source_ip,
                "sourceCountry": threat.source_country,
                "sourceRegion": threat.source_region,
                "sourceCity": threat.source_city,
                "sourceLat": threat.source_lat,
                "sourceLng": threat.source_lng,
                "targetCity": threat.target_city,
                "targetLat": 12.9716,
                "targetLng": 77.5946,
                "attackType": threat.attack_type,
                "riskScore": threat.risk_score,
                "severity": (
                    threat.risk_level.upper()
                    if threat.risk_level
                    else "LOW"
                ),
                "responseStatus": threat.response_status,
            }
        )

    return {
        "honeypot": {
            "city": "Bengaluru",
            "country": "India",
            "lat": 12.9716,
            "lng": 77.5946,
        },
        "vectors": nodes,
    }


# ==========================================
# SECURITY AUDIT LOGS
# ==========================================

@router.get("/logs")
def get_soc_logs(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Return system security audit logs."""

    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.id.desc())
        .limit(50)
        .all()
    )

    return [
        {
            "id": log.id,
            "log_id": log.log_id,
            "timestamp": log.timestamp,
            "event_id": log.event_id,
            "source_ip": log.source_ip,
            "risk_score": log.risk_score,
            "action": log.action,
            "policy_applied": log.policy_applied,
            "dry_run": log.dry_run,
            "summary": log.summary,
        }
        for log in logs
    ]
