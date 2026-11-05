"""
SentinelAI Response Policy Manager
Provides configurable threat policy definitions for automated response evaluation.
"""

from dataclasses import dataclass
from enum import Enum
from typing import List, Optional


class ResponseAction(Enum):
    MONITOR = "MONITOR"
    ALERT = "ALERT"
    BLOCK = "BLOCK"


@dataclass
class ResponsePolicy:
    name: str
    description: str
    min_risk_score: float
    max_risk_score: float
    action: ResponseAction
    enabled: bool = True


class PolicyManager:
    """
    Single source of truth for automated threat response policy evaluations.
    Strict thresholds:
    - 0.0 to 39.99   -> MONITOR
    - 40.0 to 74.99  -> ALERT
    - 75.0 to 100.0  -> BLOCK
    """

    def __init__(self):
        self.policies: List[ResponsePolicy] = [
            ResponsePolicy(
                name="Routine Activity Monitoring",
                description="Log low-risk user & network activities for audit tracking (0 to 39.99)",
                min_risk_score=0.0,
                max_risk_score=39.99,
                action=ResponseAction.MONITOR,
            ),
            ResponsePolicy(
                name="Suspicious Behavior Alerting",
                description="Trigger alerts for unusual activity frequencies or access patterns (40 to 74.99)",
                min_risk_score=40.0,
                max_risk_score=74.99,
                action=ResponseAction.ALERT,
            ),
            ResponsePolicy(
                name="Critical Threat Blocklist (Dry-Run)",
                description="Simulate autonomous IP containment for high-risk attacks (75 to 100)",
                min_risk_score=75.0,
                max_risk_score=100.0,
                action=ResponseAction.BLOCK,
            ),
        ]

    def get_policy_for_score(self, risk_score: float) -> Optional[ResponsePolicy]:
        """
        Validates risk score range (0.0 to 100.0) and returns the matching enabled policy.
        Raises ValueError for invalid risk score values (< 0.0 or > 100.0).
        Returns None if matching policy is disabled.
        """
        if not (0.0 <= risk_score <= 100.0):
            raise ValueError(f"Invalid risk score: {risk_score}. Must be between 0.0 and 100.0.")

        for policy in self.policies:
            if policy.min_risk_score <= risk_score <= policy.max_risk_score:
                if policy.enabled:
                    return policy
                return None  # Policy found but disabled

        return None

    def toggle_policy(self, name: str, enabled: bool) -> bool:
        """Enables or disables a policy by name."""
        for policy in self.policies:
            if policy.name.lower() == name.lower():
                policy.enabled = enabled
                return True
        return False
