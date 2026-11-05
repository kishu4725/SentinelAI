import joblib
import pandas as pd
import json

MODEL_FILE = "model/isolation_forest.pkl"
STATS_FILE = "model/anomaly_score_stats.json"


def predict_activity(
    protocol,
    failed_attempts,
    session_duration,
    command_count,
    login_success,
    has_request,
    has_command,
    is_login_attempt,
    is_http_request
):

    # Load trained model
    model = joblib.load(MODEL_FILE)

    # Load anomaly score statistics
    with open(STATS_FILE, "r") as file:
        stats = json.load(file)

    min_score = stats["min_score"]
    max_score = stats["max_score"]

    # Create input data
    data = pd.DataFrame([{
        "protocol": protocol,
        "failed_attempts": failed_attempts,
        "session_duration": session_duration,
        "command_count": command_count,
        "login_success": login_success,
        "has_request": has_request,
        "has_command": has_command,
        "is_login_attempt": is_login_attempt,
        "is_http_request": is_http_request
    }])

    # Prediction
    prediction = int(model.predict(data)[0])

    # Anomaly score
    anomaly_score = float(
        model.decision_function(data)[0]
    )

    # Threat classification
    threat = "Anomalous" if prediction == -1 else "Normal"

    # Convert anomaly score to risk score
    if max_score == min_score:
        risk_score = 0
    else:
        risk_score = (
            (max_score - anomaly_score)
            / (max_score - min_score)
        ) * 100

    risk_score = round(risk_score, 2)

    # Risk classification
    if risk_score >= 75:
        risk_level = "Critical"
    elif risk_score >= 50:
        risk_level = "High"
    elif risk_score >= 25:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return {
        "prediction": prediction,
        "threat": threat,
        "anomaly_score": round(anomaly_score, 6),
        "risk_score": risk_score,
        "risk_level": risk_level
    }