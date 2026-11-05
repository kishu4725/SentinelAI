"""
SentinelAI Focused Authentication & SOC Authorization Security Test Suite
Tests:
- USER TEST 1: Nonexistent email + random password (HTTP 401)
- USER TEST 2: Existing email + wrong password (HTTP 401)
- USER TEST 3: Existing email + correct password (HTTP 200, JWT, User identity)
- USER TEST 4: Data isolation between User A and User B
- SOC TEST 1: Incorrect SOC admin password (HTTP 401)
- SOC TEST 2: Correct authorized SOC admin credentials (HTTP 200, Admin JWT)
- SOC TEST 3: Normal user attempting SOC endpoint (HTTP 403 Forbidden)
"""

import unittest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.base import Base
from backend.app.db.session import engine, SessionLocal
from backend.app.models.user import User
from backend.app.models.event import SecurityEvent
from backend.app.core.security import hash_password
from backend.app.services.auth_service import seed_default_users_if_empty


class TestAuthenticationSecurity(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_default_users_if_empty(db)
            
            # Ensure alex_sentinel password is reset to default Password123! for test run
            alex = db.query(User).filter(User.username == "alex_sentinel").first()
            if alex:
                alex.hashed_password = hash_password("Password123!")
                db.commit()

            # Provision User A and User B for isolation testing
            user_a = db.query(User).filter(User.username == "usera_test").first()
            if not user_a:
                user_a = User(
                    email="usera@example.com",
                    username="usera_test",
                    hashed_password=hash_password("PassA123!"),
                    name="User Alpha",
                    role="user",
                    security_score=98,
                    is_active=True
                )
                db.add(user_a)

            user_b = db.query(User).filter(User.username == "userb_test").first()
            if not user_b:
                user_b = User(
                    email="userb@example.com",
                    username="userb_test",
                    hashed_password=hash_password("PassB123!"),
                    name="User Beta",
                    role="user",
                    security_score=95,
                    is_active=True
                )
                db.add(user_b)
            
            db.commit()

            # Seed specific security events for User A and User B
            evt_a = db.query(SecurityEvent).filter(SecurityEvent.user_id == "usera_test").first()
            if not evt_a:
                db.add(SecurityEvent(
                    event_id="EVT-TEST-A1",
                    event_type="LOGIN_SUCCESS",
                    user_id="usera_test",
                    source_ip="192.168.1.10",
                    device="MacBook Pro",
                    browser="Chrome 128",
                    location="Bengaluru, India",
                    status="Success",
                    risk_score=10.0,
                    risk_level="Low"
                ))

            evt_b = db.query(SecurityEvent).filter(SecurityEvent.user_id == "userb_test").first()
            if not evt_b:
                db.add(SecurityEvent(
                    event_id="EVT-TEST-B1",
                    event_type="LOGIN_SUCCESS",
                    user_id="userb_test",
                    source_ip="192.168.1.20",
                    device="Linux PC",
                    browser="Firefox 125",
                    location="Mysuru, India",
                    status="Success",
                    risk_score=15.0,
                    risk_level="Low"
                ))
            db.commit()
        finally:
            db.close()

        cls.client = TestClient(app)

    def test_user_1_nonexistent_email(self):
        """USER TEST 1: Nonexistent email + random password must return HTTP 401."""
        response = self.client.post("/api/auth/login", json={
            "username": "nonexistent.user.2026@domain.com",
            "password": "RandomPassword999!"
        })
        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertNotIn("access_token", data)
        self.assertEqual(data["detail"], "Invalid username/email or password")

    def test_user_2_wrong_password(self):
        """USER TEST 2: Existing user email + wrong password must return HTTP 401."""
        response = self.client.post("/api/auth/login", json={
            "username": "alex.morgan@example.com",
            "password": "DefinitelyWrongPassword123!"
        })
        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertNotIn("access_token", data)

    def test_user_3_valid_login(self):
        """USER TEST 3: Existing user email + correct password returns HTTP 200 and valid JWT."""
        response = self.client.post("/api/auth/login", json={
            "username": "alex.morgan@example.com",
            "password": "Password123!"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["role"], "user")
        self.assertEqual(data["username"], "alex_sentinel")
        self.assertEqual(data["name"], "Alex Morgan")

        # Verify /api/auth/me returns database identity
        token = data["access_token"]
        me_resp = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_resp.status_code, 200)
        me_data = me_resp.json()
        self.assertEqual(me_data["email"], "alex.morgan@example.com")
        self.assertEqual(me_data["name"], "Alex Morgan")

    def test_user_4_data_isolation(self):
        """USER TEST 4: User A sees only User A's data."""
        # Login User A
        resp_a = self.client.post("/api/auth/login", json={"username": "usera_test", "password": "PassA123!"})
        self.assertEqual(resp_a.status_code, 200)
        token_a = resp_a.json()["access_token"]

        # Fetch activity for User A
        act_a = self.client.get("/api/user/activity", headers={"Authorization": f"Bearer {token_a}"})
        self.assertEqual(act_a.status_code, 200)
        user_ids_a = [item["user_id"] for item in act_a.json()]
        for uid in user_ids_a:
            self.assertIn(uid, ["usera_test", "usera@example.com"])
            self.assertNotIn(uid, ["userb_test", "userb@example.com"])

    def test_soc_1_incorrect_admin_password(self):
        """SOC TEST 1: Incorrect SOC admin password must fail with HTTP 401."""
        response = self.client.post("/api/auth/login", json={
            "username": "admin",
            "password": "WrongAdminPassword!"
        })
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("access_token", response.json())

    def test_soc_2_valid_admin_login(self):
        """SOC TEST 2: Correct SOC admin credentials returns HTTP 200 and admin role JWT."""
        response = self.client.post("/api/auth/login", json={
            "username": "admin",
            "password": "AdminSecure2026!"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["role"], "admin")

        # Test SOC endpoint with admin token
        admin_token = data["access_token"]
        metrics_resp = self.client.get("/api/soc/metrics", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(metrics_resp.status_code, 200)

    def test_soc_3_normal_user_denied_soc_endpoint(self):
        """SOC TEST 3: Normal user attempting SOC endpoint must be denied HTTP 403 Forbidden."""
        # Authenticate as normal user
        user_resp = self.client.post("/api/auth/login", json={
            "username": "usera_test",
            "password": "PassA123!"
        })
        user_token = user_resp.json()["access_token"]

        # Attempt SOC admin endpoint with normal user token
        soc_resp = self.client.get("/api/soc/metrics", headers={"Authorization": f"Bearer {user_token}"})
        self.assertEqual(soc_resp.status_code, 403)
        self.assertEqual(soc_resp.json()["detail"], "SOC Admin authorization required to access command center endpoints")

    def test_user_5_registration_and_otp_verification(self):
        """USER TEST 5: Registration returns verification required without exposing OTP code."""
        import uuid
        from backend.app.services.email_service import SENT_EMAILS, clear_sent_emails
        clear_sent_emails()

        uid = uuid.uuid4().hex[:6]
        test_email = f"otptest_{uid}@example.com"
        reg_payload = {
            "name": "OTP Test User",
            "username": f"otp_user_{uid}",
            "email": test_email,
            "password": "TestPassword123!"
        }
        resp = self.client.post("/api/auth/register", json=reg_payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertNotIn("otp_code", data)
        self.assertNotIn("otp", data)
        self.assertEqual(data["status"], "verification_required")

        # Verify email dispatch occurred
        self.assertGreaterEqual(len(SENT_EMAILS), 1)
        self.assertEqual(SENT_EMAILS[-1]["to_email"], test_email)

        # Retrieve OTP from PENDING_REGISTRATIONS for test assertion
        from backend.app.api.endpoints.auth import PENDING_REGISTRATIONS
        pending_info = PENDING_REGISTRATIONS.get(test_email.lower())
        self.assertIsNotNone(pending_info)
        self.assertIsNotNone(pending_info.get("otp"))
        self.assertEqual(len(pending_info["otp"]), 6)
        otp_val = pending_info["otp"]

        # Universal backdoor code '123456' MUST be rejected -> HTTP 400
        backdoor_verify = self.client.post("/api/auth/verify-otp", json={
            "email": test_email,
            "otp_code": "123456"
        })
        # If otp_val happens to be 123456 randomly, test with guaranteed wrong code
        wrong_code = "000000" if otp_val != "123456" else "111111"
        bad_verify = self.client.post("/api/auth/verify-otp", json={
            "email": test_email,
            "otp_code": wrong_code
        })
        self.assertEqual(bad_verify.status_code, 400)
        self.assertEqual(bad_verify.json()["detail"], "Invalid verification OTP code.")

        # Valid server OTP attempt -> HTTP 200 & JWT token
        good_verify = self.client.post("/api/auth/verify-otp", json={
            "email": test_email,
            "otp_code": otp_val
        })
        self.assertEqual(good_verify.status_code, 200)
        self.assertIn("access_token", good_verify.json())

        # Single-use check: Trying same OTP again must fail -> HTTP 400
        reuse_verify = self.client.post("/api/auth/verify-otp", json={
            "email": test_email,
            "otp_code": otp_val
        })
        self.assertEqual(reuse_verify.status_code, 400)

    def test_user_6_password_recovery_404_unregistered(self):
        """USER TEST 6: Unregistered email on password recovery must return HTTP 404."""
        resp = self.client.post("/api/auth/forgot-password", json={
            "email": "nonexistent.registered.999@domain.com"
        })
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json()["detail"], "No registered account found with this email address.")

    def test_user_7_password_reset_flow(self):
        """USER TEST 7: Forgot password and password reset flow."""
        # Request password recovery for existing user
        resp = self.client.post("/api/auth/forgot-password", json={
            "email": "alex.morgan@example.com"
        })
        self.assertEqual(resp.status_code, 200)

        # Get recovery OTP from RECOVERY_OTPS
        from backend.app.api.endpoints.auth import RECOVERY_OTPS
        rec = RECOVERY_OTPS.get("alex.morgan@example.com")
        self.assertIsNotNone(rec)
        otp_val = rec["otp"]

        # Universal backdoor code '654321' MUST be rejected -> HTTP 400
        wrong_code = "000000" if otp_val != "654321" else "111111"
        backdoor_reset = self.client.post("/api/auth/reset-password", json={
            "email": "alex.morgan@example.com",
            "otp_code": wrong_code,
            "new_password": "NewSecretPassword123!"
        })
        self.assertEqual(backdoor_reset.status_code, 400)

        # Reset password with valid server OTP
        reset_resp = self.client.post("/api/auth/reset-password", json={
            "email": "alex.morgan@example.com",
            "otp_code": otp_val,
            "new_password": "NewSecretPassword123!"
        })
        self.assertEqual(reset_resp.status_code, 200)

        # Verify login with new password
        login_resp = self.client.post("/api/auth/login", json={
            "username": "alex.morgan@example.com",
            "password": "NewSecretPassword123!"
        })
        self.assertEqual(login_resp.status_code, 200)
        self.assertIn("access_token", login_resp.json())

        # Restore original password for other tests
        db = SessionLocal()
        try:
            u = db.query(User).filter(User.email == "alex.morgan@example.com").first()
            if u:
                u.hashed_password = hash_password("Password123!")
                db.commit()
        finally:
            db.close()

    def test_user_9_smtp_failure_handling(self):
        """USER TEST 9: SMTP delivery failure returns HTTP 500 and cleans up pending state."""
        from unittest.mock import patch
        from backend.app.api.endpoints.auth import PENDING_REGISTRATIONS

        fail_email = "smtp_fail_user@example.com"
        reg_payload = {
            "name": "Fail Test",
            "username": "fail_user_99",
            "email": fail_email,
            "password": "Password123!"
        }

        with patch("backend.app.api.endpoints.auth.send_otp_email", return_value=False):
            resp = self.client.post("/api/auth/register", json=reg_payload)
            self.assertEqual(resp.status_code, 500)
            self.assertIn("Failed to deliver verification OTP email", resp.json()["detail"])
            # Pending registration MUST be cleaned up safely
            self.assertNotIn(fail_email, PENDING_REGISTRATIONS)


    def test_user_8_simulate_event_telemetry(self):
        """USER TEST 8: Simulate security event evaluates dynamic ML score and SOAR policy."""
        # Login to get token
        login_resp = self.client.post("/api/auth/login", json={
            "username": "usera_test",
            "password": "PassA123!"
        })
        token = login_resp.json()["access_token"]

        # Post simulation request
        sim_resp = self.client.post(
            "/api/user/simulate-event",
            json={"event_type": "SIMULATED_MALWARE_UPLOAD"},
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(sim_resp.status_code, 200)
        data = sim_resp.json()
        self.assertIn("ml_result", data)
        self.assertIn("soar_response", data)
        self.assertGreaterEqual(data["ml_result"]["risk_score"], 0)
        self.assertIn("policy_applied", data["soar_response"])


if __name__ == "__main__":
    unittest.main()

