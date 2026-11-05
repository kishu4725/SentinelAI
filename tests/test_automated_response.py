"""
Unit & Integration Tests for SentinelAI Automated Mitigation Engine (Member 4)
Comprehensive test suite verifying:
- Risk score threshold evaluation (MONITOR, ALERT, BLOCK)
- Anomaly flag metadata handling without threshold override
- Validation of invalid risk scores (<0 or >100)
- Connected PolicyManager logic & disabled policy handling
- Persistent JSONL audit logging
- Safe simulated BLOCK dry-run behavior ([BLOCK_SIMULATED])
"""

import json
import os
import tempfile
import unittest

from cloud.automated_response import (
    AutomatedResponseEngine,
    ResponseAction,
    ThreatResult,
)
from cloud.policy_manager import PolicyManager


class TestAutomatedResponseEngine(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.log_file = os.path.join(self.temp_dir.name, "test_audit_logs.jsonl")
        self.pm = PolicyManager()
        self.engine = AutomatedResponseEngine(
            policy_manager=self.pm,
            audit_log_path=self.log_file,
            dry_run=True,
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_risk_20_evaluates_to_monitor(self):
        """Risk score 20.0 evaluates to MONITOR."""
        threat = ThreatResult(event_id="E-20", source_ip="192.168.1.1", risk_score=20.0)
        log = self.engine.process_threat(threat)
        self.assertEqual(log.action, "MONITOR")
        self.assertEqual(log.policy_applied, "Routine Activity Monitoring")

    def test_risk_39_99_evaluates_to_monitor(self):
        """Risk score 39.99 evaluates to MONITOR."""
        threat = ThreatResult(event_id="E-39.99", source_ip="192.168.1.2", risk_score=39.99)
        log = self.engine.process_threat(threat)
        self.assertEqual(log.action, "MONITOR")

    def test_risk_40_evaluates_to_alert(self):
        """Risk score 40.0 evaluates to ALERT."""
        threat = ThreatResult(event_id="E-40", source_ip="198.51.100.1", risk_score=40.0)
        log = self.engine.process_threat(threat)
        self.assertEqual(log.action, "ALERT")
        self.assertEqual(log.policy_applied, "Suspicious Behavior Alerting")

    def test_risk_65_anomalous_evaluates_to_alert(self):
        """Risk score 65.0 with is_anomalous=True MUST evaluate to ALERT (no override to BLOCK)."""
        threat = ThreatResult(
            event_id="E-65-ANOM",
            source_ip="198.51.100.2",
            risk_score=65.0,
            is_anomalous=True,
        )
        log = self.engine.process_threat(threat)
        self.assertEqual(log.action, "ALERT")
        self.assertTrue(log.metadata["is_anomalous"])

    def test_risk_74_99_evaluates_to_alert(self):
        """Risk score 74.99 evaluates to ALERT."""
        threat = ThreatResult(event_id="E-74.99", source_ip="198.51.100.3", risk_score=74.99)
        log = self.engine.process_threat(threat)
        self.assertEqual(log.action, "ALERT")

    def test_risk_75_evaluates_to_block_simulated(self):
        """Risk score 75.0 evaluates to BLOCK with safe simulated dry-run behavior."""
        threat = ThreatResult(event_id="E-75", source_ip="203.0.113.1", risk_score=75.0)
        log = self.engine.process_threat(threat)
        self.assertEqual(log.action, "BLOCK")
        self.assertTrue(log.dry_run)
        self.assertIn("[BLOCK_SIMULATED]", log.summary)
        self.assertEqual(log.policy_applied, "Critical Threat Blocklist (Dry-Run)")

    def test_risk_95_anomalous_evaluates_to_block_simulated(self):
        """Risk score 95.0 with is_anomalous=True evaluates to BLOCK (simulated)."""
        threat = ThreatResult(
            event_id="E-95-ANOM",
            source_ip="203.0.113.2",
            risk_score=95.0,
            is_anomalous=True,
        )
        log = self.engine.process_threat(threat)
        self.assertEqual(log.action, "BLOCK")
        self.assertTrue(log.dry_run)
        self.assertIn("[BLOCK_SIMULATED]", log.summary)
        self.assertTrue(log.metadata["is_anomalous"])

    def test_invalid_risk_below_zero_rejected(self):
        """Risk score < 0.0 (-10.0) must be rejected safely with ValueError."""
        with self.assertRaises(ValueError):
            ThreatResult(event_id="E-NEG", source_ip="1.1.1.1", risk_score=-10.0)

    def test_invalid_risk_above_hundred_rejected(self):
        """Risk score > 100.0 (150.0) must be rejected safely with ValueError."""
        with self.assertRaises(ValueError):
            ThreatResult(event_id="E-OVER", source_ip="1.1.1.1", risk_score=150.0)

    def test_disabled_policy_is_not_selected(self):
        """Disabling a policy prevents it from matching and safely rejects threat handling."""
        self.pm.toggle_policy("Suspicious Behavior Alerting", False)
        threat = ThreatResult(event_id="E-DIS", source_ip="198.51.100.5", risk_score=50.0)
        with self.assertRaises(ValueError):
            self.engine.process_threat(threat)

    def test_audit_record_persisted_to_jsonl(self):
        """Verifies that processed threat audit logs are persisted to JSONL file."""
        threat1 = ThreatResult(event_id="E-PERSIST-1", source_ip="10.0.0.1", risk_score=25.0)
        threat2 = ThreatResult(event_id="E-PERSIST-2", source_ip="10.0.0.2", risk_score=85.0)

        self.engine.process_threat(threat1)
        self.engine.process_threat(threat2)

        self.assertTrue(os.path.exists(self.log_file))
        with open(self.log_file, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]

        self.assertEqual(len(lines), 2)
        rec1 = json.loads(lines[0])
        rec2 = json.loads(lines[1])

        self.assertEqual(rec1["event_id"], "E-PERSIST-1")
        self.assertEqual(rec1["action"], "MONITOR")
        self.assertEqual(rec2["event_id"], "E-PERSIST-2")
        self.assertEqual(rec2["action"], "BLOCK")
        self.assertTrue(rec2["dry_run"])
        self.assertIn("[BLOCK_SIMULATED]", rec2["summary"])


if __name__ == "__main__":
    unittest.main()
