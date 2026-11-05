
"""
Event & Threat Ingestion Endpoints (/api/events)
Orchestrates: Original Security Event + ML Result -> Combined Threat Record
-> Cloud Automated Response Engine -> JSONL Audit Log + Database
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.event import SecurityEvent
from backend.app.models.threat import ThreatRecord
from backend.app.models.audit import AuditLog
from backend.app.schemas.event import EventIngestRequest
from backend.app.schemas.threat import (
    CombinedThreatIngestResponse,
    ThreatRecordOut,
)
from backend.app.services.ml_service import MLService
from backend.app.services.cloud_service import cloud_service
from backend.app.services.geoip_service import get_geo_for_ip
from backend.app.core.config import settings
from backend.app.core.websocket import soc_ws_manager
from backend.app.api.deps import require_sensor_key

router = APIRouter(prefix="/events", tags=["Event Ingestion & Processing"])


def _coerce_score(value):
    """Return a float in [0, 100], or None if the value is missing or invalid."""
    if value is None:
        return None
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    if not (0.0 <= score <= 100.0):
        return None
    return score


def _get_event_status(event_type: str, ml_result: dict, audit_entry) -> str:
    """
    Report the event outcome separately from the automated response.

    Failed authentication is recorded as Failed.
    A simulated block is recorded as Detected, not as a real block.
    Other anomalous events are recorded as Detected.
    """
    event_type_upper = str(event_type or "").upper()

    if (
        event_type_upper in {"LOGIN_FAILED", "AUTH_FAILED"}
        or event_type_upper.endswith("_LOGIN_FAILED")
    ):
        return "Failed"

    if audit_entry.action == "BLOCK":
        return "Detected" if audit_entry.dry_run else "Blocked"

    if ml_result.get("prediction") == -1:
        return "Detected"

    return "Success"


@router.post("/ingest", response_model=CombinedThreatIngestResponse)
def ingest_security_event(
    request: EventIngestRequest,
    db: Session = Depends(get_db),
    _sensor_key: str = Depends(require_sensor_key),
):
    """
    Core pipeline:
    0. Authenticate the sensor (X-API-Key). The server computes the risk score itself;
       a client-supplied details.risk_score is ignored unless SENTINEL_TRUST_CLIENT_RISK_SCORE=true.
    1. Receive security event metadata.
    2. Evaluate the event using the ML service.
    3. Process the threat through the cloud response engine.
    4. Persist the security event, threat record, and audit log.
    5. Broadcast the event to connected SOC WebSocket clients.
    """
    event_uuid = f"EVT-{uuid.uuid4().hex[:8].upper()}"
    now_utc = datetime.now(timezone.utc)

    # Enrich source IP with geo-location.
    raw_ip = request.source_ip or "0.0.0.0"
    geo = get_geo_for_ip(raw_ip)

    resolved_city = request.source_city or geo["city"]
    resolved_country = request.source_country or geo["country"]
    resolved_region = request.source_region or geo["region"]
    resolved_lat = (
        request.source_lat
        if request.source_lat is not None
        else geo["lat"]
    )
    resolved_lng = (
        request.source_lng
        if request.source_lng is not None
        else geo["lng"]
    )

    if resolved_city not in ("Unknown", "Private Network"):
        resolved_location_str = f"{resolved_city}, {resolved_country}"
    else:
        resolved_location_str = geo["geo_source"].upper()

    # Evaluate the event using the ML service.
    details = dict(request.details or {})
    client_risk = _coerce_score(details.pop("risk_score", None))
    trust_client = settings.trust_client_risk_score()

    if client_risk is not None and trust_client:
        custom_risk = client_risk
        details["risk_score"] = client_risk
    else:
        custom_risk = None
        if client_risk is not None:
            # Keep a record of the claim for the audit trail, but never score with it.
            details["client_risk_score_ignored"] = client_risk

    ml_result = MLService.evaluate_event(
        event_type=request.event_type,
        custom_risk_score=custom_risk,
        details=details,
    )

    # Process threat through the cloud automated-response engine.
    audit_entry = cloud_service.process_threat_telemetry(
        event_id=event_uuid,
        source_ip=raw_ip,
        risk_score=ml_result["risk_score"],
        threat_type=request.event_type,
        user_id=request.user_id,
        location=resolved_location_str,
        is_anomalous=(ml_result["prediction"] == -1),
        details=details,
    )

    # Record the event outcome accurately.
    event_status = _get_event_status(
        request.event_type,
        ml_result,
        audit_entry,
    )

    # Persist the original security event.
    db_event = SecurityEvent(
        event_id=event_uuid,
        event_type=request.event_type,
        user_id=request.user_id,
        source_ip=raw_ip,
        device=request.device or "Windows PC",
        browser=request.browser or "Chrome 128",
        location=resolved_location_str,
        status=event_status,
        risk_score=ml_result["risk_score"],
        risk_level=ml_result["risk_level"],
        timestamp=now_utc,
    )
    db.add(db_event)

    # Persist the combined threat record.
    db_threat = ThreatRecord(
        event_id=event_uuid,
        source_ip=raw_ip,
        source_country=resolved_country,
        source_region=resolved_region,
        source_city=resolved_city,
        source_lat=resolved_lat,
        source_lng=resolved_lng,
        target_city=request.target_city or "Bengaluru",
        attack_type=request.event_type,
        user_id=request.user_id,
        device=request.device,
        browser=request.browser,
        prediction=ml_result["prediction"],
        threat_status=ml_result["threat"],
        anomaly_score=ml_result["anomaly_score"],
        risk_score=ml_result["risk_score"],
        risk_level=ml_result["risk_level"],
        is_anomalous=(ml_result["prediction"] == -1),
        response_status=(
            "BLOCKED_SIMULATED"
            if audit_entry.action == "BLOCK" and audit_entry.dry_run
            else audit_entry.action
        ),
        policy_applied=audit_entry.policy_applied,
        timestamp=now_utc,
    )
    db.add(db_threat)

    # Mirror the cloud audit entry into the database.
    db_audit = AuditLog(
        log_id=audit_entry.log_id,
        timestamp=audit_entry.timestamp,
        event_id=event_uuid,
        source_ip=audit_entry.source_ip,
        risk_score=audit_entry.risk_score,
        action=audit_entry.action,
        policy_applied=audit_entry.policy_applied,
        dry_run=audit_entry.dry_run,
        summary=audit_entry.summary,
        metadata_json=json.dumps(audit_entry.metadata),
    )
    db.add(db_audit)

    # Commit all database records together.
    db.commit()
    db.refresh(db_threat)

    threat_out = ThreatRecordOut(
        id=db_threat.id,
        event_id=db_threat.event_id,
        source_ip=db_threat.source_ip,
        source_country=db_threat.source_country,
        source_region=db_threat.source_region,
        source_city=db_threat.source_city,
        source_lat=db_threat.source_lat,
        source_lng=db_threat.source_lng,
        target_city=db_threat.target_city,
        attack_type=db_threat.attack_type,
        risk_score=db_threat.risk_score,
        risk_level=db_threat.risk_level,
        prediction=db_threat.prediction,
        threat_status=db_threat.threat_status,
        anomaly_score=db_threat.anomaly_score,
        is_anomalous=db_threat.is_anomalous,
        response_status=db_threat.response_status,
        timestamp=db_threat.timestamp.isoformat(),
    )

    # Broadcast the event to connected SOC WebSocket clients.
    soc_ws_manager.broadcast_sync(
        {
            "type": "NEW_THREAT_EVENT",
            "event_id": threat_out.event_id,
            "event_type": threat_out.attack_type,
            "timestamp": threat_out.timestamp,
            "source_ip": threat_out.source_ip,
            "user_id": request.user_id or "Anonymous/System",
            "location": (
                f"{threat_out.source_city}, "
                f"{threat_out.source_country}"
            ),
            "risk_score": threat_out.risk_score,
            "risk_level": threat_out.risk_level,
            "prediction": threat_out.prediction,
            "anomaly_score": threat_out.anomaly_score,
            "response_status": threat_out.response_status,
            "policy_applied": audit_entry.policy_applied,
            "threat_record": threat_out.model_dump(),
        }
    )

    return CombinedThreatIngestResponse(
        message=(
            "Event successfully ingested, evaluated by ML, "
            "and processed by Cloud SOAR engine."
        ),
        original_event=request.model_dump(),
        ml_result=ml_result,
        threat_record=threat_out,
        audit_log=audit_entry.to_dict(),
    )
