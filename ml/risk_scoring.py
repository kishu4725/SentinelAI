import pandas as pd

INPUT_FILE = "dataset/processed/anomaly_results.csv"
OUTPUT_FILE = "dataset/processed/risk_results.csv"


def calculate_risk():

    # Load anomaly results
    df = pd.read_csv(INPUT_FILE)

    # Get minimum and maximum anomaly scores
    min_score = df["anomaly_score"].min()
    max_score = df["anomaly_score"].max()

    # Convert anomaly score to 0-100 risk score
    if max_score == min_score:
        df["risk_score"]=0
    else:
        df["risk_score"] = (
            (max_score - df["anomaly_score"])
            / (max_score - min_score)
    ) * 100

    # Round risk score
    df["risk_score"] = df["risk_score"].round(2)

    # Risk classification
    def classify_risk(score):

        if score >= 75:
            return "Critical"

        elif score >= 50:
            return "High"

        elif score >= 25:
            return "Medium"

        else:
            return "Low"

    df["risk_level"] = df["risk_score"].apply(classify_risk)

    # Save results
    df.to_csv(OUTPUT_FILE, index=False)

    print("Risk scoring completed successfully!")

    print("\nRisk Results:")
    print(
        df[
            [
                "anomaly_score",
                "threat",
                "risk_score",
                "risk_level"
            ]
        ]
    )

    print("\nRisk Level Distribution:")
    print(df["risk_level"].value_counts())

    print("\nResults saved to:", OUTPUT_FILE)


if __name__ == "__main__":
    calculate_risk()