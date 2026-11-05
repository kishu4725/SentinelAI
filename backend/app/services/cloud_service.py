"""
Cloud Automated Mitigation Service Bridge
Integrates backend telemetry directly with existing cloud.automated_response and cloud.policy_manager
"""

from typing import Dict, Any, List
from cloud.automated_response import AutomatedResponseEngine, ThreatResult, AuditLogEntry
from cloud.policy_manager import PolicyManager


class CloudMitigationService:
    """
    Bridge service connecting FastAPI orchestrator to Member 4 Cloud Automated Response Engine.
    Preserves exact 0-39.99 MONITOR, 40-74.99 ALERT, 75-100 BLOCK (BLOCK_SIMULATED) response policy.
    """

    def __init__(self):
        self.policy_manager = PolicyManager()
        self.engine = AutomatedResponseEngine(
            policy_manager=self.policy_manager,
            audit_log_path="cloud/audit_logs.jsonl",
            dry_run=True,
        )

    def process_threat_telemetry(
        self,
        event_id: str,
        source_ip: str,
        risk_score: float,
        threat_type: str = "ANOMALY_DETECTION",
        user_id: str = None,
        location: str = "Unknown",
        is_anomalous: bool = False,
        details: Dict[str, Any] = None,
    ) -> AuditLogEntry:
        """
        Constructs ThreatResult and executes automated mitigation via cloud.automated_response.
        """
        threat = ThreatResult(
            event_id=event_id,
            source_ip=source_ip,
            risk_score=float(risk_score),
            threat_type=threat_type,
            user_id=user_id,
            location=location,
            is_anomalous=is_anomalous,
            details=details or {},
        )
        audit_log = self.engine.process_threat(threat)
        return audit_log

    def get_soar_policies(self) -> List[Dict[str, Any]]:
        """Returns active SOAR policies from PolicyManager."""
        return [
            {
                "name": p.name,
                "description": p.description,
                "min_risk_score": p.min_risk_score,
                "max_risk_score": p.max_risk_score,
                "action": p.action.value,
                "enabled": p.enabled,
            }
            for p in self.policy_manager.policies
        ]

    def toggle_soar_policy(self, policy_name: str, enabled: bool) -> bool:
        """Toggles an active SOAR policy in PolicyManager."""
        return self.policy_manager.toggle_policy(policy_name, enabled)

    def get_audit_trail(self) -> List[Dict[str, Any]]:
        """Retrieves audit trail entries."""
        return [entry.to_dict() for entry in self.engine.get_audit_trail()]


cloud_service = CloudMitigationService()
