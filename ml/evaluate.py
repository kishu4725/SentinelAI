import pandas as pd
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

INPUT_FILE = "dataset/processed/detection_results.csv"
LABEL_FILE = "dataset/raw/honeypot_logs.csv"


def evaluate_model():

    # Load actual labels
    labels_df = pd.read_csv(LABEL_FILE)

    # Load model predictions
    predictions_df = pd.read_csv(INPUT_FILE)

    # Convert labels to binary
    # Normal = 1
    # Anomalous = -1
    actual = labels_df["label"].map({
        "Normal": 1,
        "Anomalous": -1
    })

    predicted = predictions_df["prediction"]

    # Calculate metrics
    accuracy = accuracy_score(actual, predicted)
    precision = precision_score(actual, predicted, pos_label=-1)
    recall = recall_score(actual, predicted, pos_label=-1)
    f1 = f1_score(actual, predicted, pos_label=-1)

    # Confusion matrix
    cm = confusion_matrix(actual, predicted, labels=[1, -1])

    print("========== MODEL EVALUATION ==========")

    print(f"\nAccuracy : {accuracy:.2f}")
    print(f"Precision: {precision:.2f}")
    print(f"Recall   : {recall:.2f}")
    print(f"F1 Score : {f1:.2f}")

    print("\nConfusion Matrix:")
    print(cm)

    print("\n=======================================")


if __name__ == "__main__":
    evaluate_model()