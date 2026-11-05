import pandas as pd

INPUT_FILE = "dataset/raw/security_log.csv"
OUTPUT_FILE = "dataset/processed/processed_logs.csv"


def preprocess_data():

    # Load real honeypot dataset
    df = pd.read_csv(INPUT_FILE)

    print("Original dataset shape:", df.shape)

    # Remove duplicate records
    df = df.drop_duplicates()

    # Convert timestamp
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    # Fill missing categorical values
    categorical_columns = [
        "method",
        "request",
        "username",
        "command",
        "event"
    ]

    for column in categorical_columns:
        df[column] = df[column].fillna("unknown")

    # Convert login_success to numerical value
    # False = 0
    # Missing/unknown = 0
    df["login_success"] = (
        df["login_success"]
        .fillna(False)
        .astype(int)
    )

    # Convert protocol to numerical value
    df["protocol"] = df["protocol"].map({
        "SSH": 0,
        "HTTP": 1
    }).fillna(-1)

    # Create HTTP request indicator
    df["has_request"] = (
        (df["request"] != "unknown") &
        (df["request"] != "/")
    ).astype(int)

    # Create command activity indicator
    df["has_command"] = (
        df["command"] != "unknown"
    ).astype(int)

    # Create login attempt indicator
    df["is_login_attempt"] = (
        df["event"] == "login_attempt"
    ).astype(int)

    # Create HTTP event indicator
    df["is_http_request"] = (
        df["event"] == "http_request"
    ).astype(int)

    # Save processed data
    processed_columns = [
        "timestamp",
        "ip",
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

    processed_df = df[processed_columns]

    processed_df.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print("\nProcessed dataset:")
    print(processed_df)

    print("\nProcessed shape:", processed_df.shape)

    print("\nPreprocessing completed successfully!")


if __name__ == "__main__":
    preprocess_data()