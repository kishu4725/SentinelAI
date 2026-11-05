import json
import math
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import IsolationForest

MODEL_FILE = Path(__file__).parent / "model" / "isolation_forest.pkl"
STATS_FILE = Path(__file__).parent / "model" / "anomaly_score_stats.json"
METADATA_FILE = Path(__file__).parent / "model" / "model_metadata.json"

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

def build_training_dataset() -> pd.DataFrame:
    """
    Generates a 300-sample balanced training dataset adhering strictly to the
    12-feature numerical schema specifications.
    """
    rows = []

    # 1. Normal User Activity (100 samples)
    for i in range(80):
        duration = 30.0 + (i * 10)
        rows.append({
            "protocol_numeric": 1.0,
            "failed_attempts": 0.0,
            "auth_failure_ratio": 0.0,
            "session_duration": math.log1p(duration),
            "command_count": float(i % 5),
            "login_success_flag": 1.0,
            "is_login_event": 1.0,
            "is_http_event": 0.0,
            "transfer_burst_rate": 0.0,
            "endpoint_risk_depth": 0.1,
            "action_destructiveness": 0.0,
            "is_off_hours": 0.0,
        })
    for i in range(20):
        rows.append({
            "protocol_numeric": 2.0,
            "failed_attempts": 0.0,
            "auth_failure_ratio": 0.0,
            "session_duration": math.log1p(10.0),
            "command_count": 0.0,
            "login_success_flag": 0.0,
            "is_login_event": 0.0,
            "is_http_event": 1.0,
            "transfer_burst_rate": 1.0 + (i % 3),
            "endpoint_risk_depth": 0.1,
            "action_destructiveness": 0.0,
            "is_off_hours": 0.5, # neutral missing timestamp
        })

    # 2. Benign Single/Low Failed Logins (40 samples)
    for f_cnt in [1, 1, 1, 1, 2, 2, 3, 3]:
        for _ in range(5):
            rows.append({
                "protocol_numeric": 1.0,
                "failed_attempts": float(f_cnt),
                "auth_failure_ratio": float(f_cnt / (f_cnt + 1.0)),
                "session_duration": math.log1p(10.0),
                "command_count": 0.0,
                "login_success_flag": 0.0,
                "is_login_event": 1.0,
                "is_http_event": 0.0,
                "transfer_burst_rate": 0.0,
                "endpoint_risk_depth": 0.1,
                "action_destructiveness": 0.0,
                "is_off_hours": 0.0,
            })

    # 3. Brute Force Attacks (60 samples)
    for f_cnt in [10, 15, 20, 25, 30, 50]:
        for _ in range(10):
            rows.append({
                "protocol_numeric": 1.0,
                "failed_attempts": float(f_cnt),
                "auth_failure_ratio": float(f_cnt / (f_cnt + 1.0)),
                "session_duration": math.log1p(2.0),
                "command_count": 0.0,
                "login_success_flag": 0.0,
                "is_login_event": 1.0,
                "is_http_event": 0.0,
                "transfer_burst_rate": 0.0,
                "endpoint_risk_depth": 0.1,
                "action_destructiveness": 0.0,
                "is_off_hours": 1.0,
            })

    # 4. Unauthorized Downloads & Exfiltration (60 samples)
    for rate in [6, 8, 10, 15, 20, 30]:
        for _ in range(10):
            rows.append({
                "protocol_numeric": 2.0,
                "failed_attempts": 0.0,
                "auth_failure_ratio": 0.0,
                "session_duration": math.log1p(300.0),
                "command_count": 10.0,
                "login_success_flag": 0.0,
                "is_login_event": 0.0,
                "is_http_event": 1.0,
                "transfer_burst_rate": float(rate),
                "endpoint_risk_depth": 0.9,
                "action_destructiveness": 0.8,
                "is_off_hours": 0.5,
            })

    # 5. Suspicious HTTP/API Probing & Fuzzing (40 samples)
    for depth in [0.8, 0.9, 1.0]:
        for _ in range(13):
            rows.append({
                "protocol_numeric": 2.0,
                "failed_attempts": 2.0,
                "auth_failure_ratio": 2.0 / 3.0,
                "session_duration": math.log1p(5.0),
                "command_count": 0.0,
                "login_success_flag": 0.0,
                "is_login_event": 0.0,
                "is_http_event": 1.0,
                "transfer_burst_rate": 0.0,
                "endpoint_risk_depth": float(depth),
                "action_destructiveness": 0.5,
                "is_off_hours": 1.0,
            })
    rows.append({
        "protocol_numeric": 2.0,
        "failed_attempts": 3.0,
        "auth_failure_ratio": 0.75,
        "session_duration": math.log1p(5.0),
        "command_count": 0.0,
        "login_success_flag": 0.0,
        "is_login_event": 0.0,
        "is_http_event": 1.0,
        "transfer_burst_rate": 0.0,
        "endpoint_risk_depth": 0.9,
        "action_destructiveness": 0.5,
        "is_off_hours": 1.0,
    })

    df = pd.DataFrame(rows)
    return df[FEATURE_NAMES]

def train_model():
    df = build_training_dataset()

    model = IsolationForest(
        n_estimators=100,
        contamination=0.2,
        random_state=42
    )

    model.fit(df)

    anomaly_scores = model.decision_function(df)

    score_stats = {
        "model_version": "v1.1.0",
        "feature_count": len(FEATURE_NAMES),
        "feature_names": FEATURE_NAMES,
        "min_score": float(anomaly_scores.min()),
        "max_score": float(anomaly_scores.max()),
    }

    MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_FILE)

    with open(STATS_FILE, "w") as f:
        json.dump(score_stats, f, indent=4)

    metadata = {
        "model": "Isolation Forest",
        "model_version": "v1.1.0",
        "n_estimators": 100,
        "contamination": 0.2,
        "number_of_samples": len(df),
        "number_of_features": len(FEATURE_NAMES),
        "features": FEATURE_NAMES,
    }

    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=4)

    print(f"Isolation Forest model (v1.1.0) trained successfully on {len(df)} samples across 12 features!")
    print(f"Min Score: {score_stats['min_score']:.6f}, Max Score: {score_stats['max_score']:.6f}")

if __name__ == "__main__":
    train_model()