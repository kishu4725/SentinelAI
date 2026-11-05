"""
SentinelAI Cloud & Automated Response Engine
Implements Member 4 Automated Mitigation Foundation:
INPUT FROM BACKEND -> Threat Result -> PolicyManager -> ResponsePolicy -> ResponseAction -> AutomatedResponseEngine -> Audit Log (JSONL) -> SOC Dashboard
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import logging
import os
import uuid
from typing import Dict, List, Optional

from cloud.policy_manager import PolicyManager, ResponseAction, ResponsePolicy

logger = logging.getLogger("SentinelAI.AutomatedResponse")


@dataclass
class ThreatResult:
    """Represents a threat evaluation payload received from backend/ML layer."""
    event_id: str
    source_ip: str
    risk_score: float  # Must be 0.0 to 100.0
    threat_type: str = "ANOMALY_DETECTION"
    user_id: Optional[str] = None
    location: str = "Unknown"
    is_anomalous: bool = False
    details: Dict = field(default_factory=dict)

    def __post_init__(self):
        if not isinstance(self.risk_score, (int, float)):
            raise ValueError(f"Invalid risk_score type: {type(self.risk_score)}. Must be float or int.")
        if not (0.0 <= self.risk_score <= 100.0):
            raise ValueError(f"Invalid risk score: {self.risk_score}. Must be between 0.0 and 100.0.")


@dataclass
class AuditLogEntry:
    """Structured audit trail record for SOAR operations."""
    log_id: str
    timestamp: str
    event_id: str
    source_ip: str
    risk_score: float
    action: str
    policy_applied: str
    dry_run: bool
    summary: str
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "log_id": self.log_id,
            "timestamp": self.timestamp,
            "event_id": self.event_id,
            "source_ip": self.source_ip,
            "risk_score": self.risk_score,
            "action": self.action,
            "policy_applied": self.policy_applied,
            "dry_run": self.dry_run,
            "summary": self.summary,
            "metadata": self.metadata,
        }


class AutomatedResponseEngine:
    """
    SentinelAI Automated Mitigation & SOAR Response Engine.
    Uses PolicyManager as the single source of truth for decision evaluations.
    Enforces safe dry-run mode for BLOCK actions and persists audit logs to JSONL.
    """

    def __init__(
        self,
        policy_manager: Optional[PolicyManager] = None,
        audit_log_path: str = "cloud/audit_logs.jsonl",
        dry_run: bool = True,
    ):
        self.policy_manager = policy_manager or PolicyManager()
        self.audit_log_path = audit_log_path
        self.dry_run = dry_run
        self.audit_trail: List[AuditLogEntry] = []
        self._log_counter = 0

    @classmethod
    def process_event(
        cls,
        event_id: str,
        source_ip: str,
        risk_score: float,
        event_type: str = "ANOMALY_DETECTION",
        user_id: Optional[str] = None,
        location: str = "Unknown",
        is_anomalous: bool = False,
        details: Optional[Dict] = None,
    ) -> Dict:
        engine = cls()
        threat = ThreatResult(
            event_id=event_id,
            source_ip=source_ip,
            risk_score=float(risk_score),
            threat_type=event_type,
            user_id=user_id,
            location=location,
            is_anomalous=is_anomalous,
            details=details or {},
        )
        audit_entry = engine.process_threat(threat)
        response_status = "MONITOR" if risk_score < 40 else ("ALERT" if risk_score < 75 else "BLOCK_SIMULATED")
        return {
            "action": audit_entry.action,
            "response_status": response_status,
            "policy_applied": audit_entry.policy_applied,
            "dry_run": audit_entry.dry_run,
            "summary": audit_entry.summary,
            "log_id": audit_entry.log_id,
        }

    def evaluate_threat(self, threat: ThreatResult) -> ResponsePolicy:
        """
        Evaluates a threat through the connected PolicyManager.
        Raises ValueError if risk score is out of bounds or if no policy is enabled.
        """
        policy = self.policy_manager.get_policy_for_score(threat.risk_score)
        if policy is None:
            raise ValueError(
                f"No active response policy found or policy is disabled for risk score {threat.risk_score}."
            )
        return policy

    def process_threat(self, threat: ThreatResult) -> AuditLogEntry:
        """
        Executes the response pipeline for an incoming threat result:
        1. Evaluate threat through PolicyManager -> ResponsePolicy -> ResponseAction
        2. Handle mitigation (Dry-run for BLOCK -> BLOCK_SIMULATED)
        3. Write to in-memory audit trail and append to persistent JSONL log
        """
        policy = self.evaluate_threat(threat)
        action = policy.action

        self._log_counter += 1
        # Globally unique: a per-process counter repeats after every restart (and for every
        # engine created by process_event), which produced duplicate log_ids.
        log_id = f"SOAR-LOG-{uuid.uuid4().hex[:12].upper()}"
        now_utc = datetime.now(timezone.utc).isoformat()

        # Audit Field dry_run Semantics:
        # - dry_run=False for MONITOR/ALERT: The internal workflow is executed (recording and publishing an alert).
        #   It does not mean external containment occurred.
        # - dry_run=True for BLOCK: Containment is simulated as BLOCK_SIMULATED; no real firewall, network, or host-isolation action is performed.
        if action == ResponseAction.MONITOR:
            summary = f"Event [{threat.event_id}] logged under monitoring (Risk Score: {threat.risk_score}/100)."
            is_dry = False

        elif action == ResponseAction.ALERT:
            summary = f"Security Alert triggered for IP {threat.source_ip} (Risk Score: {threat.risk_score}/100)."
            is_dry = False

        else:  # ResponseAction.BLOCK
            # BLOCK actions are ALWAYS dry-run simulated
            summary = (
                f"[BLOCK_SIMULATED] Simulated firewall block for IP {threat.source_ip} "
                f"(Risk Score: {threat.risk_score}/100). No real IP ban enforced."
            )
            is_dry = True

        log_entry = AuditLogEntry(
            log_id=log_id,
            timestamp=now_utc,
            event_id=threat.event_id,
            source_ip=threat.source_ip,
            risk_score=threat.risk_score,
            action=action.value,
            policy_applied=policy.name,
            dry_run=is_dry,
            summary=summary,
            metadata={
                "threat_type": threat.threat_type,
                "location": threat.location,
                "user_id": threat.user_id,
                "is_anomalous": threat.is_anomalous,
                "details": threat.details,
            },
        )

        # In-memory record
        self.audit_trail.append(log_entry)

        # Persistent JSONL write
        self._persist_log_entry(log_entry)

        logger.info(f"[{log_entry.action}] {log_entry.summary}")
        return log_entry

    def _persist_log_entry(self, entry: AuditLogEntry) -> None:
        """Appends audit log entry as a single JSON line to persistent file."""
        try:
            dirname = os.path.dirname(self.audit_log_path)
            if dirname and not os.path.exists(dirname):
                os.makedirs(dirname, exist_ok=True)

            with open(self.audit_log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry.to_dict()) + "\n")
        except Exception as err:
            logger.error(f"Failed to persist audit log entry to {self.audit_log_path}: {err}")

    def get_audit_trail(self) -> List[AuditLogEntry]:
        """Returns copy of in-memory recorded audit log entries."""
        return list(self.audit_trail)

    def clear_audit_trail(self) -> None:
        """Clears in-memory audit logs."""
        self.audit_trail.clear()
        self._log_counter = 0
