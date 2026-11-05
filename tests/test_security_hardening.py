"""
Tests for the Step 1/2 hardening changes that do not need a running database:
secret-key handling, unique audit log ids, ML model status, and the sensor-key dependency.
"""

import importlib
import importlib.util
import os
import tempfile
import unittest
from unittest.mock import patch

from cloud.automated_response import AutomatedResponseEngine, ThreatResult
from cloud.policy_manager import PolicyManager


def _reload_config():
    import backend.app.core.config as config
    return importlib.reload(config)


class TestSecretKeyResolution(unittest.TestCase):

    def tearDown(self):
        # Restore the module to the real environment for other tests.
        _reload_config()

    def test_production_refuses_missing_secret(self):
        with patch.dict(os.environ, {"SENTINEL_ENV": "production", "SECRET_KEY": ""}):
            with self.assertRaises(RuntimeError):
                _reload_config()

    def test_production_refuses_legacy_default_secret(self):
        with patch.dict(os.environ, {
            "SENTINEL_ENV": "production",
            "SECRET_KEY": "sentinelai_super_secret_jwt_key_2026",
        }):
            with self.assertRaises(RuntimeError):
                _reload_config()

    def test_development_without_secret_uses_random_key(self):
        with patch.dict(os.environ, {"SENTINEL_ENV": "development", "SECRET_KEY": ""}):
            cfg = _reload_config()
            self.assertGreaterEqual(len(cfg.settings.SECRET_KEY), 40)
            self.assertNotEqual(cfg.settings.SECRET_KEY, "sentinelai_super_secret_jwt_key_2026")

    def test_explicit_secret_is_used(self):
        with patch.dict(os.environ, {"SENTINEL_ENV": "production", "SECRET_KEY": "x" * 48}):
            cfg = _reload_config()
            self.assertEqual(cfg.settings.SECRET_KEY, "x" * 48)

    def test_runtime_flags_default_to_safe_values(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SENTINEL_TRUST_CLIENT_RISK_SCORE", None)
            os.environ.pop("SENTINEL_SENSOR_API_KEY", None)
            cfg = _reload_config()
            self.assertFalse(cfg.settings.trust_client_risk_score())
            self.assertEqual(cfg.settings.sensor_api_key(), "")

    def test_cors_origins_can_be_overridden(self):
        with patch.dict(os.environ, {"SENTINEL_CORS_ORIGINS": "https://a.example, https://b.example"}):
            cfg = _reload_config()
            self.assertEqual(cfg.settings.CORS_ORIGINS, ["https://a.example", "https://b.example"])


class TestUniqueAuditLogIds(unittest.TestCase):

    def test_fresh_engines_never_repeat_log_ids(self):
        """process_event builds a new engine each call; ids used to restart at 00001 every time."""
        ids = set()
        with tempfile.TemporaryDirectory() as tmp:
            for i in range(60):
                engine = AutomatedResponseEngine(
                    policy_manager=PolicyManager(),
                    audit_log_path=os.path.join(tmp, "audit.jsonl"),
                    dry_run=True,
                )
                entry = engine.process_threat(
                    ThreatResult(event_id=f"EVT-{i}", source_ip="198.51.100.1", risk_score=50.0)
                )
                ids.add(entry.log_id)
        self.assertEqual(len(ids), 60)


class TestMLModelStatus(unittest.TestCase):

    def test_model_status_reports_mode_and_reason(self):
        from backend.app.services.ml_service import MLService
        status = MLService.model_status()
        self.assertIn(status["mode"], {"isolation_forest+rules", "rules_only"})
        if status["loaded"]:
            self.assertIsNone(status["reason"])
        else:
            self.assertTrue(status["reason"])


@unittest.skipUnless(importlib.util.find_spec("fastapi"), "fastapi not installed")
class TestSensorKeyDependency(unittest.TestCase):

    def test_unconfigured_key_fails_closed(self):
        from fastapi import HTTPException
        from backend.app.api.deps import require_sensor_key
        with patch.dict(os.environ, {"SENTINEL_SENSOR_API_KEY": ""}):
            with self.assertRaises(HTTPException) as ctx:
                require_sensor_key("anything")
        self.assertEqual(ctx.exception.status_code, 503)

    def test_wrong_and_missing_keys_rejected(self):
        from fastapi import HTTPException
        from backend.app.api.deps import require_sensor_key
        with patch.dict(os.environ, {"SENTINEL_SENSOR_API_KEY": "right"}):
            for bad in (None, "", "wrong"):
                with self.assertRaises(HTTPException) as ctx:
                    require_sensor_key(bad)
                self.assertEqual(ctx.exception.status_code, 401)

    def test_correct_key_accepted(self):
        from backend.app.api.deps import require_sensor_key
        with patch.dict(os.environ, {"SENTINEL_SENSOR_API_KEY": "right"}):
            self.assertEqual(require_sensor_key("right"), "right")


if __name__ == "__main__":
    unittest.main()
