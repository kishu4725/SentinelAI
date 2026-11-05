"""
Unit and Integration Tests for SentinelAI Hybrid ML Service
Verifies feature adapter, IsolationForest model inference, rule-based overrides,
and strict adherence to the 5-field ML API contract.
"""

import pytest
from backend.app.services.ml_service import MLService


def test_feature_adapter_extraction():
    """Verifies that extract_feature_vector produces all 12 required features."""
    event_type = "LOGIN_SUCCESS"
    details = {"session_duration": 150, "failed_count": 0}
    features = MLService.extract_feature_vector(event_type, details)

    assert isinstance(features, dict)
    assert len(features) == 12
    assert features["login_success_flag"] == 1.0
    assert features["failed_attempts"] == 0.0


def test_normal_login_success_contract_and_safety():
    """Verifies that LOGIN_SUCCESS remains Normal / Low Risk and non-anomalous."""
    res = MLService.evaluate_event("LOGIN_SUCCESS", details={"session_duration": 120})

    assert res["prediction"] == 1
    assert res["threat"] == "Normal"
    assert res["risk_score"] <= 18.0
    assert res["risk_level"] in ["Low", "Normal"]
    assert "anomaly_score" in res


def test_single_failed_login():
    """Verifies single isolated failed login evaluates to Normal / Medium-Low risk."""
    res = MLService.evaluate_event("LOGIN_FAILED", details={"failed_count": 1})

    assert res["prediction"] == 1
    assert res["threat"] == "Normal"
    assert 15.0 <= res["risk_score"] <= 45.0


def test_brute_force_pattern_detection():
    """Verifies repeated failed logins (>=10) evaluate to Anomalous and High/Critical risk."""
    res = MLService.evaluate_event("BRUTE_FORCE", details={"failed_count": 10})

    assert res["prediction"] == -1
    assert res["threat"] == "Anomalous"
    assert res["risk_score"] >= 85.0
    assert res["risk_level"] in ["High", "Critical"]


def test_rapid_resource_access_probing():
    """Verifies rapid resource burst evaluates to High risk anomalous event."""
    res = MLService.evaluate_event("RAPID_RESOURCE_ACCESS", details={"upload_burst_rate": 8})

    assert res["prediction"] == -1
    assert res["threat"] == "Anomalous"
    assert res["risk_score"] >= 75.0


def test_unauthorized_download_exfiltration():
    """Verifies unauthorized data exfiltration triggers elevated risk score."""
    res = MLService.evaluate_event("UNAUTHORIZED_DOWNLOAD", details={"session_duration": 600})

    assert res["risk_score"] >= 50.0
    assert res["risk_level"] in ["Medium", "High", "Critical"]


def test_malformed_event_handling_safety():
    """Verifies that missing, None, or empty parameters fail gracefully without crashing."""
    res = MLService.evaluate_event(None, details=None)

    assert isinstance(res, dict)
    assert set(res.keys()) == {"prediction", "threat", "anomaly_score", "risk_score", "risk_level"}
    assert 0.0 <= res["risk_score"] <= 100.0


def test_benign_password_change_and_user_profile():
    """Verifies benign PASSWORD_CHANGE and USER_PROFILE_GET evaluate to Normal / Low Risk under Hypothesis B."""
    res_pass = MLService.evaluate_event("PASSWORD_CHANGE", details={"session_duration": 45})
    assert res_pass["prediction"] == 1
    assert res_pass["threat"] == "Normal"
    assert res_pass["risk_score"] <= 25.0

    res_prof = MLService.evaluate_event("USER_PROFILE_GET", details={"url": "/api/user/profile", "protocol": "HTTP"})
    assert res_prof["prediction"] == 1
    assert res_prof["threat"] == "Normal"
    assert res_prof["risk_score"] <= 25.0


def test_authorized_low_rate_downloads_and_uploads():
    """Verifies low-rate FILE_DOWNLOAD and FILE_UPLOAD evaluate to Normal."""
    res_dl = MLService.evaluate_event("FILE_DOWNLOAD", details={"upload_burst_rate": 2.0, "url": "/files/doc.pdf"})
    assert res_dl["prediction"] == 1
    assert res_dl["threat"] == "Normal"
    assert res_dl["risk_score"] <= 30.0

    res_ul = MLService.evaluate_event("FILE_UPLOAD", details={"upload_burst_rate": 3.0, "url": "/upload/avatar.jpg"})
    assert res_ul["prediction"] == 1
    assert res_ul["threat"] == "Normal"
    assert res_ul["risk_score"] <= 30.0


def test_high_rate_exfiltration_disguised_as_file_download():
    """Verifies high burst rate exfiltration disguised as FILE_DOWNLOAD triggers Anomalous / High Risk."""
    res = MLService.evaluate_event("FILE_DOWNLOAD", details={"upload_burst_rate": 25.0, "url": "/files/confidential.zip"})
    assert res["prediction"] == -1
    assert res["threat"] == "Anomalous"
    assert res["risk_score"] >= 85.0
    assert res["risk_level"] in ["High", "Critical"]


def test_sql_injection_disguised_as_user_profile_get():
    """Verifies SQL injection payload in query params disguised as USER_PROFILE_GET overrides benign name."""
    res = MLService.evaluate_event("USER_PROFILE_GET", details={"url": "/api/user/profile", "query": "id=1' OR '1'='1"})
    assert res["prediction"] == -1
    assert res["threat"] == "Anomalous"
    assert res["risk_score"] >= 85.0
    assert res["risk_level"] in ["High", "Critical"]


def test_unfamiliar_ssh_bursts_and_moderate_auth_failures():
    """Verifies SSH bursts and moderate authentication failures evaluate accurately without false alarms."""
    res_ssh = MLService.evaluate_event("SSH_SESSION", details={"command_count": 50, "protocol": "SSH"})
    assert res_ssh["risk_score"] >= 40.0

    res_mod_auth = MLService.evaluate_event("LOGIN_FAILED", details={"failed_count": 4})
    assert res_mod_auth["prediction"] == 1
    assert res_mod_auth["threat"] == "Normal"
    assert 20.0 <= res_mod_auth["risk_score"] <= 40.0


def test_missing_malformed_and_conflicting_telemetry_fields():
    """Verifies resilience to missing, malformed, and conflicting telemetry fields."""
    res_empty = MLService.evaluate_event("UNKNOWN_EVENT", details={})
    assert set(res_empty.keys()) == {"prediction", "threat", "anomaly_score", "risk_score", "risk_level"}

    res_malformed = MLService.evaluate_event("LOGIN_FAILED", details={"failed_count": "invalid", "upload_burst_rate": None})
    assert set(res_malformed.keys()) == {"prediction", "threat", "anomaly_score", "risk_score", "risk_level"}
    assert 0.0 <= res_malformed["risk_score"] <= 100.0

    res_conflict = MLService.evaluate_event("LOGIN_FAILED", details={"login_success": True, "failed_count": 0})
    assert set(res_conflict.keys()) == {"prediction", "threat", "anomaly_score", "risk_score", "risk_level"}

