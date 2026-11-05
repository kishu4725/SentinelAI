from preprocessing import preprocess_data
from feature_extraction import extract_features
from anomaly_detection import detect_anomalies
from risk_scoring import calculate_risk


def run_pipeline():

    print("\n========================================")
    print(" AI-DRIVEN CLOUD THREAT INTELLIGENCE")
    print(" MEMBER 1 → MEMBER 2 PIPELINE")
    print("========================================")

    # Step 1
    print("\n[1/4] Processing honeypot logs...")
    preprocess_data()

    # Step 2
    print("\n[2/4] Extracting ML features...")
    extract_features()

    # Step 3
    print("\n[3/4] Detecting anomalies...")
    detect_anomalies()

    # Step 4
    print("\n[4/4] Calculating risk scores...")
    calculate_risk()

    print("\n========================================")
    print(" INTEGRATION COMPLETED SUCCESSFULLY")
    print("========================================")

    print("\nFinal output:")
    print("dataset/processed/risk_results.csv")


if __name__ == "__main__":
    run_pipeline()