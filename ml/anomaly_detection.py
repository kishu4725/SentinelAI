import pandas as pd
import joblib

INPUT_FILE = "dataset/processed/features.csv"
MODEL_FILE = "model/isolation_forest.pkl"
OUTPUT_FILE = "dataset/processed/anomaly_results.csv"


def detect_anomalies():

    # Load features
    df = pd.read_csv(INPUT_FILE)

    # Load trained Isolation Forest model
    model = joblib.load(MODEL_FILE)

    # Keep only the features used during training
    feature_columns = [
        "protocol",
        "failed_attempts",
        "session_duration",
        "command_count",
        "login_success",
        "has_request",
        "has_command",
        "is_login_attempt",
        "is_http_request"
    ]

    X = df[feature_columns]

    # Predict anomalies
    df["prediction"] = model.predict(X)

    # Calculate anomaly score BEFORE adding extra columns to X
    df["anomaly_score"] = model.decision_function(X)

    # Convert prediction into threat label
    df["threat"] = df["prediction"].map({
        1: "Normal",
        -1: "Anomalous"
    })

    # Save results
    df.to_csv(OUTPUT_FILE, index=False)

    print("Anomaly detection completed successfully!")

    print("\nAnomaly Results:")
    print(df)

    print("\nThreat Distribution:")
    print(df["threat"].value_counts())

    print("\nResults saved to:", OUTPUT_FILE)


if __name__ == "__main__":
    detect_anomalies()