"""
SOAR Automated Mitigation & Policy Pydantic Schemas
"""

from typing import List, Dict, Optional
from pydantic import BaseModel


class SOARPolicyOut(BaseModel):
    name: str
    description: str
    min_risk_score: float
    max_risk_score: float
    action: str
    enabled: bool


class PolicyToggleRequest(BaseModel):
    enabled: bool


class SOARAuditLogOut(BaseModel):
    log_id: str
    timestamp: str
    event_id: str
    source_ip: str
    risk_score: float
    action: str
    policy_applied: str
    dry_run: bool
    summary: str
    metadata: Dict
