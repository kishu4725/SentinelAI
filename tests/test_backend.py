"""
SentinelAI FastAPI Backend Core Integration & API Test Suite
Verifies:
- Root health check / and /docs
- Auth endpoints (/api/auth/login, /api/auth/register)
- Event Ingestion Pipeline (/api/events/ingest)
- ML Contract Bridge integration
- Cloud AutomatedResponseEngine & PolicyManager bridge integration
- Database persistence (SQLite)
"""

import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.ml_service import MLService
from cloud.automated_response import ResponseAction


from backend.app.db.base import Base
from backend.app.db.session import engine, SessionLocal
from backend.app.services.auth_service import seed_default_users_if_empty
from backend.app.services.telemetry_service import seed_initial_threats_if_empty


SENSOR_KEY = "test-sensor-key"
SENSOR_HEADERS = {"X-API-Key": SENSOR_KEY}


class TestSentinelAIBackend(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Sensors must authenticate; existing ingest tests also pin the risk score via
        # details.risk_score, which the server only honours in this explicit demo/test mode.
        cls._env_patch = patch.dict(os.environ, {
            "SENTINEL_SENSOR_API_KEY": SENSOR_KEY,
            "SENTINEL_TRUST_CLIENT_RISK_SCORE": "true",
        })
        cls._env_patch.start()
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_default_users_if_empty(db)
            seed_initial_threats_if_empty(db)
        finally:
            db.close()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls._env_patch.stop()

    def test_root_health_check(self):
        """GET / returns status online."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "online")
        self.assertEqual(data["health"], "OK")

    def test_docs_page_accessible(self):
        """GET /docs returns OpenAPI documentation HTML."""
        response = self.client.get("/docs")
        self.assertEqual(response.status_code, 200)

    def test_auth_login_default_user(self):
        """POST /api/auth/login authenticates seeded default user."""
        payload = {
            "username": "alex_sentinel",
            "password": "Password123!"
        }
        response = self.client.post("/api/auth/login", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["role"], "user")

    def test_auth_login_admin_user(self):
        """POST /api/auth/login authenticates seeded SOC Admin user."""
        payload = {
            "username": "admin",
            "password": "AdminSecure2026!"
        }
        response = self.client.post("/api/auth/login", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["role"], "admin")

    def test_auth_register_new_user(self):
        """POST /api/auth/register registers new user and requires OTP verification."""
        import uuid
        uid = uuid.uuid4().hex[:6]
        payload = {
            "email": f"new.user.{uid}@example.com",
            "username": f"user_{uid}",
            "password": "MySecretPass123!",
            "name": "New Test User"
        }
        response = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "verification_required")
        self.assertEqual(data["email"], f"new.user.{uid}@example.com")

    def test_ml_service_contract(self):
        """MLService must adhere strictly to 5-field ML contract."""
        res = MLService.evaluate_event("LOGIN_FAILED", details={"failed_count": 12})
        self.assertIn("prediction", res)
        self.assertIn("threat", res)
        self.assertIn("anomaly_score", res)
        self.assertIn("risk_score", res)
        self.assertIn("risk_level", res)
        self.assertEqual(res["prediction"], -1)
        self.assertEqual(res["threat"], "Anomalous")
        self.assertEqual(res["risk_score"], 99.05)

    def test_event_ingestion_pipeline_low_risk(self):
        """Ingesting low-risk event triggers MONITOR and persists to DB & JSONL audit trail."""
        payload = {
            "event_type": "PASSWORD_CHANGE",
            "user_id": "alex_sentinel",
            "source_ip": "192.168.1.45",
            "device": "Windows PC",
            "browser": "Chrome 128",
            "location": "Mysuru, India",
            "details": {"risk_score": 10.0}
        }
        response = self.client.post("/api/events/ingest", json=payload, headers=SENSOR_HEADERS)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["ml_result"]["risk_score"], 10.0)
        self.assertEqual(data["audit_log"]["action"], "MONITOR")

    def test_event_ingestion_pipeline_high_risk_block_simulated(self):
        """Ingesting high-risk event triggers BLOCK_SIMULATED dry-run and persists to DB."""
        payload = {
            "event_type": "LOGIN_FAILED",
            "user_id": "unknown_attacker",
            "source_ip": "198.51.100.99",
            "device": "Linux Workstation",
            "browser": "Firefox 125",
            "location": "Frankfurt, Germany",
            "source_country": "Germany",
            "source_city": "Frankfurt",
            "details": {"failed_count": 15, "risk_score": 95.0}
        }
        response = self.client.post("/api/events/ingest", json=payload, headers=SENSOR_HEADERS)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["ml_result"]["prediction"], -1)
        self.assertEqual(data["threat_record"]["response_status"], "BLOCKED_SIMULATED")
        self.assertTrue(data["audit_log"]["dry_run"])
        self.assertIn("[BLOCK_SIMULATED]", data["audit_log"]["summary"])

    def _get_admin_headers(self):
        resp = self.client.post("/api/auth/login", json={"username": "admin", "password": "AdminSecure2026!"})
        if resp.status_code == 200 and "access_token" in resp.json():
            return {"Authorization": f"Bearer {resp.json()['access_token']}"}
        return {}

    def test_user_security_status_endpoint(self):
        """GET /api/user/security-status returns status schema."""
        response = self.client.get("/api/user/security-status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("securityScore", data)
        self.assertIn("activitySummary", data)

    def test_soc_summary_metrics_endpoint(self):
        """GET /api/soc/metrics returns metrics schema."""
        headers = self._get_admin_headers()
        response = self.client.get("/api/soc/metrics", headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("activeCount", data)
        self.assertIn("blockedCount", data)

    def test_soc_attack_map_endpoint(self):
        """GET /api/soc/attack-map returns Leaflet-formatted attack vectors."""
        headers = self._get_admin_headers()
        response = self.client.get("/api/soc/attack-map", headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("honeypot", data)
        self.assertIn("vectors", data)

    def test_soar_policies_endpoint(self):
        """GET /api/mitigation/policies returns active SOAR policies."""
        headers = self._get_admin_headers()
        response = self.client.get("/api/mitigation/policies", headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(len(data) >= 3)

    # ---------------- Security hardening ----------------

    def _ingest_payload(self, **details):
        return {
            "event_type": "CLOUD_BRUTE_FORCE",
            "user_id": "attacker",
            "source_ip": "198.51.100.77",
            "details": details,
        }

    def test_ingest_rejects_missing_sensor_key(self):
        response = self.client.post("/api/events/ingest", json=self._ingest_payload())
        self.assertEqual(response.status_code, 401)

    def test_ingest_rejects_wrong_sensor_key(self):
        response = self.client.post(
            "/api/events/ingest", json=self._ingest_payload(), headers={"X-API-Key": "wrong"}
        )
        self.assertEqual(response.status_code, 401)

    def test_ingest_disabled_when_sensor_key_not_configured(self):
        with patch.dict(os.environ, {"SENTINEL_SENSOR_API_KEY": ""}):
            response = self.client.post(
                "/api/events/ingest", json=self._ingest_payload(), headers=SENSOR_HEADERS
            )
        self.assertEqual(response.status_code, 503)

    def test_client_supplied_risk_score_is_ignored_by_default(self):
        """A sensor claiming risk 5 must not be able to downgrade a brute-force event."""
        with patch.dict(os.environ, {"SENTINEL_TRUST_CLIENT_RISK_SCORE": "false"}):
            response = self.client.post(
                "/api/events/ingest",
                json=self._ingest_payload(failed_count=25, risk_score=5.0),
                headers=SENSOR_HEADERS,
            )
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.json()["ml_result"]["risk_score"], 5.0)

    def test_mitigation_endpoints_require_admin(self):
        self.assertEqual(self.client.get("/api/mitigation/policies").status_code, 401)
        self.assertEqual(self.client.get("/api/mitigation/audit-trail").status_code, 401)
        self.assertEqual(
            self.client.patch("/api/mitigation/policies/anything", json={"enabled": False}).status_code, 401
        )

    def test_audit_trail_is_persistent_and_admin_only(self):
        self.client.post(
            "/api/events/ingest", json=self._ingest_payload(failed_count=20), headers=SENSOR_HEADERS
        )
        response = self.client.get("/api/mitigation/audit-trail", headers=self._get_admin_headers())
        self.assertEqual(response.status_code, 200)
        logs = response.json()
        self.assertGreaterEqual(len(logs), 1)
        self.assertIn("log_id", logs[0])

    def test_soc_websocket_rejects_unauthenticated_clients(self):
        with self.assertRaises(Exception):  # exception type differs across Starlette versions
            with self.client.websocket_connect("/api/ws/soc"):
                pass

    def test_detailed_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("ml_model", data)
        self.assertIn("database", data)


if __name__ == "__main__":
    unittest.main()
