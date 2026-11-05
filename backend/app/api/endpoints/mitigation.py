"""
SOAR Automated Mitigation & Audit Endpoints (/api/mitigation)
All endpoints require an authenticated SOC admin.
"""

import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_admin
from backend.app.db.session import get_db
from backend.app.models.audit import AuditLog
from backend.app.models.user import User
from backend.app.schemas.mitigation import SOARPolicyOut, PolicyToggleRequest, SOARAuditLogOut
from backend.app.services.cloud_service import cloud_service

router = APIRouter(prefix="/mitigation", tags=["SOAR Automated Mitigation"])


@router.get("/policies", response_model=List[SOARPolicyOut])
def get_soar_policies(admin: User = Depends(get_current_admin)):
    """Lists active SOAR mitigation policies from PolicyManager."""
    policies = cloud_service.get_soar_policies()
    return [SOARPolicyOut(**p) for p in policies]


@router.patch("/policies/{policy_name}")
def toggle_soar_policy(
    policy_name: str,
    request: PolicyToggleRequest,
    admin: User = Depends(get_current_admin),
):
    """Enables or disables an active SOAR policy in PolicyManager."""
    success = cloud_service.toggle_soar_policy(policy_name, request.enabled)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SOAR Policy '{policy_name}' not found",
        )
    return {"message": f"Policy '{policy_name}' updated successfully", "enabled": request.enabled}


@router.get("/audit-trail", response_model=List[SOARAuditLogOut])
def get_soar_audit_trail(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Returns the persistent SOAR audit trail (newest first) from the database,
    so it survives backend restarts.
    """
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()

    results = []
    for log in logs:
        try:
            metadata = json.loads(log.metadata_json) if log.metadata_json else {}
        except (TypeError, ValueError):
            metadata = {}
        results.append(
            SOARAuditLogOut(
                log_id=log.log_id,
                timestamp=str(log.timestamp),
                event_id=log.event_id,
                source_ip=log.source_ip,
                risk_score=float(log.risk_score),
                action=log.action,
                policy_applied=log.policy_applied,
                dry_run=bool(log.dry_run),
                summary=log.summary,
                metadata=metadata if isinstance(metadata, dict) else {},
            )
        )
    return results
