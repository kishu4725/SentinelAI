import pandas as pd

INPUT_FILE = "dataset/processed/processed_logs.csv"
OUTPUT_FILE = "dataset/processed/features.csv"


def extract_features():

    # Load processed honeypot data
    df = pd.read_csv(INPUT_FILE)

    # Numerical behavioral features
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

    # Extract ML features
    X = df[feature_columns]

    # Save features
    X.to_csv(OUTPUT_FILE, index=False)

    print("Extracted features:")
    print(X)

    print("\nFeature shape:", X.shape)

    print("\nFeature statistics:")
    print(X.describe())

    print("\nFeature extraction completed successfully!")


if __name__ == "__main__":
    extract_features()