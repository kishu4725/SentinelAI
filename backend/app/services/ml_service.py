"""
SentinelAI Hybrid ML Anomaly Scoring Service (v1.1.0)
Integrates trained scikit-learn IsolationForest model inference with a 12-feature numerical adapter,
4-point metadata compatibility checks, and two-stage rule safety overrides.

Strictly adheres to the SentinelAI 5-Field ML Contract:
{
  "prediction": -1 | 1,
  "threat": "Anomalous" | "Normal",
  "anomaly_score": float,
  "risk_score": float,
  "risk_level": "Critical" | "High" | "Medium" | "Low" | "Normal"
}
"""

import json
import logging
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

import joblib
import pandas as pd

logger = logging.getLogger("SentinelAI.MLService")

# Locate model files relative to project root
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
MODEL_PATH = BASE_DIR / "ml" / "model" / "isolation_forest.pkl"
STATS_PATH = BASE_DIR / "ml" / "model" / "anomaly_score_stats.json"

_loaded_model = None
_loaded_stats = None
_model_load_error: Optional[str] = None

FEATURE_NAMES = [
    "protocol_numeric",
    "failed_attempts",
    "auth_failure_ratio",
    "session_duration",
    "command_count",
    "login_success_flag",
    "is_login_event",
    "is_http_event",
    "transfer_burst_rate",
    "endpoint_risk_depth",
    "action_destructiveness",
    "is_off_hours",
]


def _get_model_and_stats() -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
    """
    Lazy loads trained IsolationForest PKL model and performs strict 4-point compatibility checks:
    1. Estimator feature count == 12
    2. Exact feature ordering == FEATURE_NAMES
    3. Schema version string == "v1.1.0"
    4. Valid normalization statistics (min_score < max_score)
    If any check fails, explicitly logs a WARNING and falls back to heuristic scoring.
    """
    global _loaded_model, _loaded_stats, _model_load_error
    if _loaded_model is None and MODEL_PATH.exists():
        try:
            model = joblib.load(MODEL_PATH)
            stats = None
            if STATS_PATH.exists():
                with open(STATS_PATH, "r") as f:
                    stats = json.load(f)

            # 4-Point Runtime Compatibility Checks
            feat_count = getattr(model, "n_features_in_", 0)
            feat_names = stats.get("feature_names", []) if stats else []
            version = stats.get("model_version", "") if stats else ""
            min_s = stats.get("min_score", 0.0) if stats else 0.0
            max_s = stats.get("max_score", 0.0) if stats else 0.0

            if feat_count != len(FEATURE_NAMES):
                logger.warning(
                    f"Model feature count mismatch ({feat_count} != {len(FEATURE_NAMES)}). "
                    "Model inference failed/unmatched, falling back to heuristic engine."
                )
                _model_load_error = f"Feature count mismatch ({feat_count} != {len(FEATURE_NAMES)})"
                _loaded_model = False
            elif feat_names != FEATURE_NAMES:
                logger.warning(
                    "Model feature names order mismatch. "
                    "Model inference failed/unmatched, falling back to heuristic engine."
                )
                _model_load_error = "Feature names/order in anomaly_score_stats.json do not match the backend"
                _loaded_model = False
            elif version != "v1.1.0":
                logger.warning(
                    f"Model version mismatch ({version} != v1.1.0). "
                    "Model inference failed/unmatched, falling back to heuristic engine."
                )
                _model_load_error = f"Model version mismatch ({version} != v1.1.0)"
                _loaded_model = False
            elif min_s >= max_s:
                logger.warning(
                    "Model score statistics invalid (min_score >= max_score). "
                    "Model inference failed/unmatched, falling back to heuristic engine."
                )
                _model_load_error = "Invalid score statistics (min_score >= max_score)"
                _loaded_model = False
            else:
                _loaded_model = model
                _loaded_stats = stats
                logger.info("Loaded scikit-learn IsolationForest PKL model (v1.1.0) successfully.")
        except Exception as err:
            logger.warning(f"Could not load IsolationForest model ({err}), falling back to heuristic engine.")
            _model_load_error = f"Could not load model: {type(err).__name__}: {err}"
            _loaded_model = False

    return (_loaded_model if _loaded_model is not False else None), _loaded_stats


def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


class MLService:
    """
    Hybrid ML Service combining IsolationForest model inference with 12-feature numerical adaptation
    and calibrated rule safety overrides.
    """

    @staticmethod
    def model_status() -> Dict[str, Any]:
        """
        Reports whether the Isolation Forest is actually in use. When it is not, scoring
        silently degrades to rules only, so this is surfaced at startup and on /api/health.
        """
        model, stats = _get_model_and_stats()
        if model is not None and stats:
            return {
                "loaded": True,
                "mode": "isolation_forest+rules",
                "model_version": stats.get("model_version"),
                "feature_count": stats.get("feature_count"),
                "reason": None,
            }
        if not MODEL_PATH.exists():
            reason = f"Model file not found at {MODEL_PATH}. Run: python ml/train.py"
        else:
            reason = _model_load_error or "Model could not be loaded."
        return {
            "loaded": False,
            "mode": "rules_only",
            "model_version": None,
            "feature_count": None,
            "reason": reason,
        }

    @staticmethod
    def extract_feature_vector(event_type: str, details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Feature Adapter: Converts incoming API security event parameters into the
        exact 12 numerical features expected by the trained IsolationForest model.
        Observed request/protocol metadata takes precedence over event-name inference.
        """
        event_type_upper = str(event_type or "").upper()
        details = details or {}

        # 1. Protocol Numeric: Observed metadata precedence
        if "protocol" in details:
            prot_val = details["protocol"]
            protocol_numeric = 2.0 if str(prot_val).upper() in ["HTTP", "HTTPS", "2", "2.0"] else 1.0
        elif any(k in event_type_upper for k in ["HTTP", "RESOURCE", "DOWNLOAD", "API"]):
            protocol_numeric = 2.0
        else:
            protocol_numeric = 1.0

        # 2. Failed Attempts: Observed metadata precedence with safe parsing
        if "failed_count" in details or "failed_attempts" in details:
            raw_fc = details.get("failed_count", details.get("failed_attempts"))
            failed_attempts = _safe_float(raw_fc, 0.0)
        elif "BRUTE" in event_type_upper:
            failed_attempts = 10.0
        elif "LOGIN_FAILED" in event_type_upper or "FAILED" in event_type_upper:
            failed_attempts = 1.0
        else:
            failed_attempts = 0.0

        # 3. Auth Failure Ratio: Bounded non-linear transformation [0.0, 1.0)
        auth_failure_ratio = float(failed_attempts / (failed_attempts + 1.0))

        # 4. Session Duration: Observed metadata precedence (log1p transformed)
        if "session_duration" in details:
            dur_sec = _safe_float(details["session_duration"], 10.0)
        elif event_type_upper == "LOGIN_SUCCESS":
            dur_sec = 120.0
        else:
            dur_sec = 10.0
        session_duration = float(math.log1p(max(0.0, dur_sec)))

        # 5. Command Count: Strictly isolated from command fields
        command_count = _safe_float(details.get("command_count", details.get("commands_run")), 0.0)

        # 6. Login Success Flag: Observed metadata precedence
        if "login_success" in details:
            login_success_flag = 1.0 if details["login_success"] in [True, 1, "1", "true", "True"] else 0.0
        else:
            login_success_flag = 1.0 if event_type_upper == "LOGIN_SUCCESS" else 0.0

        # 7. Is Login Event: Observed metadata precedence
        if "is_login" in details:
            is_login_event = 1.0 if details["is_login"] in [True, 1, "1", "true", "True"] else 0.0
        else:
            is_login_event = 1.0 if any(k in event_type_upper for k in ["LOGIN", "AUTH", "BRUTE"]) else 0.0

        # 8. Is HTTP Event: Observed metadata precedence
        if "is_http" in details:
            is_http_event = 1.0 if details["is_http"] in [True, 1, "1", "true", "True"] else 0.0
        elif protocol_numeric == 2.0 or "url" in details or "request" in details:
            is_http_event = 1.0
        elif any(k in event_type_upper for k in ["RESOURCE", "DOWNLOAD", "API", "HTTP"]):
            is_http_event = 1.0
        else:
            is_http_event = 0.0

        # 9. Transfer Burst Rate: Single source field details.upload_burst_rate
        transfer_burst_rate = _safe_float(details.get("upload_burst_rate"), 0.0)

        # 10. Endpoint Risk Depth: URL path & query string sensitivity check (SQL/XSS/Admin detection)
        url_raw = str(details.get("url", details.get("request", details.get("path", ""))))
        query_raw = str(details.get("query", details.get("query_string", details.get("query_params", details.get("params", "")))))
        full_payload_str = (url_raw + " " + query_raw).lower()

        sql_xss_patterns = [
            "' or '", "' or 1=1", "' or '1'='1", "' or 1 = 1", "or 'a'='a'",
            "union select", "union all select", "select * from", "drop table", "--", "exec(",
            "<script", "javascript:", "onerror=", "onload=", "alert(",
            "sleep(", "benchmark(", "information_schema", "xp_cmdshell", "insert into", "<svg", "<iframe"
        ]
        admin_patterns = ["/admin", "/config", "/graphql", "/export", "/internal", "/debug"]

        if any(pat in full_payload_str for pat in sql_xss_patterns) or any(sens in full_payload_str for sens in admin_patterns):
            endpoint_risk_depth = 0.9
        elif url_raw and url_raw != "/":
            endpoint_risk_depth = 0.4
        else:
            endpoint_risk_depth = 0.1

        # 11. Action Destructiveness: Structural severity
        if any(k in event_type_upper for k in ["DELETE", "ESCALATION", "EXFIL", "DROP"]):
            action_destructiveness = 0.8
        elif any(k in event_type_upper for k in ["DOWNLOAD", "UPLOAD"]):
            action_destructiveness = 0.4
        else:
            action_destructiveness = 0.0

        # 12. Is Off Hours: Timezone-aware evaluation against UTC+05:30 context (Default 0.5 if timestamp missing)
        timestamp_raw = details.get("timestamp")
        if timestamp_raw:
            try:
                if isinstance(timestamp_raw, str):
                    dt = datetime.fromisoformat(timestamp_raw.replace("Z", "+00:00"))
                elif isinstance(timestamp_raw, datetime):
                    dt = timestamp_raw
                else:
                    dt = None

                if dt:
                    # Convert to IST (UTC+05:30)
                    ist_tz = timezone(timedelta(hours=5, minutes=30))
                    dt_ist = dt.astimezone(ist_tz)
                    hour = dt_ist.hour
                    # Off-hours defined as 22:00 (10 PM) to 06:00 (6 AM)
                    is_off_hours = 1.0 if (hour >= 22 or hour < 6) else 0.0
                else:
                    is_off_hours = 0.5
            except Exception:
                is_off_hours = 0.5
        else:
            is_off_hours = 0.5

        return {
            "protocol_numeric": float(protocol_numeric),
            "failed_attempts": float(failed_attempts),
            "auth_failure_ratio": float(auth_failure_ratio),
            "session_duration": float(session_duration),
            "command_count": float(command_count),
            "login_success_flag": float(login_success_flag),
            "is_login_event": float(is_login_event),
            "is_http_event": float(is_http_event),
            "transfer_burst_rate": float(transfer_burst_rate),
            "endpoint_risk_depth": float(endpoint_risk_depth),
            "action_destructiveness": float(action_destructiveness),
            "is_off_hours": float(is_off_hours),
        }

    @staticmethod
    def evaluate_event(
        event_type: str,
        custom_risk_score: Optional[float] = None,
        details: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Evaluates event through 12-feature adaptation, IsolationForest inference,
        and payload-scoped rule safety overrides (Hypothesis B). Returns exact 5-field ML contract.
        """
        details = details or {}
        event_type_upper = str(event_type or "").upper()

        # Step 1: Feature Adaptation & IsolationForest Model Inference
        features = MLService.extract_feature_vector(event_type, details)
        model, stats = _get_model_and_stats()

        model_prediction = 1
        raw_anomaly_score = 0.050000
        calculated_risk_score = None

        if model and stats:
            try:
                # Order features strictly by FEATURE_NAMES
                df_input = pd.DataFrame([features])[FEATURE_NAMES]
                model_pred = int(model.predict(df_input)[0])
                raw_score = float(model.decision_function(df_input)[0])

                min_score = stats.get("min_score", -0.15)
                max_score = stats.get("max_score", 0.15)

                if max_score != min_score:
                    norm_score = ((max_score - raw_score) / (max_score - min_score)) * 100.0
                else:
                    norm_score = 50.0

                model_prediction = model_pred
                raw_anomaly_score = raw_score
                calculated_risk_score = round(max(0.0, min(100.0, norm_score)), 2)
            except Exception as err:
                logger.warning(f"Model inference failed ({err}), defaulting to baseline rules.")

        # Step 2: Baseline Heuristic Evaluation (Hypothesis-Calibrated Rules)
        if custom_risk_score is not None:
            baseline_risk = float(custom_risk_score)
        else:
            if event_type_upper == "LOGIN_FAILED":
                failed_count = features.get("failed_attempts", 1.0)
                # Calibrated hypothesis formula: 15.0 + (failed_count * 3.0)
                baseline_risk = min(99.05 if failed_count >= 10 else 15.0 + (failed_count * 3.0), 100.0)
            elif event_type_upper in ["RAPID_RESOURCE_ACCESS", "BRUTE_FORCE", "CLOUD_BRUTE_FORCE"]:
                baseline_risk = 88.50
            elif event_type_upper in ["FILE_DELETE", "UNAUTHORIZED_DOWNLOAD", "IAM_ROLE_ESCALATION"]:
                baseline_risk = 62.00
            elif event_type_upper in ["FILE_UPLOAD", "FILE_DOWNLOAD"]:
                upload_rate = features.get("transfer_burst_rate", 0.0)
                # Calibrated hypothesis threshold: high risk if burst_rate > 10
                baseline_risk = 68.00 if upload_rate > 10 else 18.50
            elif event_type_upper == "PASSWORD_CHANGE":
                baseline_risk = 5.00
            elif event_type_upper in ["HTTP_SQLI", "HTTP_XSS", "HONEYPOT_LOGIN_ACCEPTED"]:
                # Honeypot sensor events: injection payloads, and any accepted login on a honeypot
                # (no legitimate user ever logs into one).
                baseline_risk = 85.00
            elif event_type_upper == "PRIVILEGE_ESCALATION":
                baseline_risk = 70.00
            elif event_type_upper == "HTTP_SCAN":
                baseline_risk = 55.00
            elif features.get("command_count", 0.0) >= 20.0:
                baseline_risk = 55.00
            else:
                baseline_risk = 12.00

        # Step 3: Hybrid Signal Fusion & Two-Stage Payload-Scoped Safety Overrides
        if custom_risk_score is not None:
            final_risk = float(custom_risk_score)
        elif calculated_risk_score is not None:
            # Blend model score with baseline risk
            final_risk = (calculated_risk_score * 0.4) + (baseline_risk * 0.6)
        else:
            final_risk = baseline_risk

        # Rule Override 1: LOGIN_SUCCESS must be non-anomalous to prevent contamination bias false alarms
        if event_type_upper == "LOGIN_SUCCESS":
            prediction = 1
            threat = "Normal"
            if custom_risk_score is None:
                final_risk = min(final_risk, 18.0)
            raw_anomaly_score = max(raw_anomaly_score, 0.050)

        # Rule Override 2: High-Severity Threats (BRUTE_FORCE, failed_count >= 10, burst > 10, SQL/XSS) must be Anomalous
        elif (
            event_type_upper in ["BRUTE_FORCE", "CLOUD_BRUTE_FORCE", "UNAUTHORIZED_API_CALL",
                                 "HTTP_SQLI", "HTTP_XSS", "HONEYPOT_LOGIN_ACCEPTED"]
            or features.get("failed_attempts", 0.0) >= 10.0
            or features.get("transfer_burst_rate", 0.0) > 10.0
            or features.get("endpoint_risk_depth", 0.0) >= 0.9
        ):
            prediction = -1
            threat = "Anomalous"
            if features.get("failed_attempts", 0.0) >= 10.0 and event_type_upper == "LOGIN_FAILED":
                final_risk = 99.05
            elif custom_risk_score is None:
                final_risk = max(final_risk, 85.0)
            raw_anomaly_score = min(raw_anomaly_score, -0.066645)

        # Rule Override 3 (Hypothesis B): Payload-Scoped Benign Safety Overrides
        # Verifies observed payload details before forcing prediction = 1 (Normal)
        elif (
            event_type_upper in ["PASSWORD_CHANGE", "USER_PROFILE_GET"]
            and features.get("failed_attempts", 0.0) == 0.0
            and features.get("endpoint_risk_depth", 0.0) <= 0.4
            and features.get("action_destructiveness", 0.0) == 0.0
        ):
            prediction = 1
            threat = "Normal"
            if custom_risk_score is None:
                final_risk = min(final_risk, 25.0)

        elif (
            event_type_upper in ["FILE_DOWNLOAD", "FILE_UPLOAD"]
            and features.get("transfer_burst_rate", 0.0) <= 10.0
            and features.get("action_destructiveness", 0.0) <= 0.4
            and features.get("endpoint_risk_depth", 0.0) <= 0.4
        ):
            prediction = 1
            threat = "Normal"
            if custom_risk_score is None:
                final_risk = min(final_risk, 30.0)

        else:
            prediction = -1 if (model_prediction == -1 or final_risk >= 75.0) else 1
            threat = "Anomalous" if prediction == -1 else "Normal"

        final_risk = round(max(0.0, min(100.0, final_risk)), 2)

        # Map Risk Level
        if final_risk >= 90.0:
            risk_level = "Critical"
        elif final_risk >= 75.0:
            risk_level = "High"
        elif final_risk >= 40.0:
            risk_level = "Medium"
        elif final_risk <= 15.0:
            risk_level = "Low"
        else:
            risk_level = "Normal"

        return {
            "prediction": prediction,
            "threat": threat,
            "anomaly_score": round(raw_anomaly_score, 6),
            "risk_score": final_risk,
            "risk_level": risk_level,
        }

