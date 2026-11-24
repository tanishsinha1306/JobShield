
from pathlib import Path
import json
import joblib
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
    ConfusionMatrixDisplay
)

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = BASE_DIR / "dataset" / "processed" / "cleaned_jobs.csv"
MODEL_DIR = BASE_DIR / "ml" / "models"
OUTPUT_DIR = BASE_DIR / "ml" / "outputs"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Load model metadata
with open(MODEL_DIR / "model_metadata.json", "r") as file:
    metadata = json.load(file)

THRESHOLD = metadata["threshold"]
RANDOM_STATE = metadata["random_state"]
TEST_SIZE = metadata["test_size"]

# Load trained model and vectorizer
print("Loading trained production model...")

model = joblib.load(MODEL_DIR / "best_model.pkl")
vectorizer = joblib.load(MODEL_DIR / "tfidf_vectorizer.pkl")

# Load processed dataset
print("Loading processed dataset...")

df = pd.read_csv(DATA_PATH, keep_default_na=False)

X = df["combined_text"].astype(str)
y = df["fraudulent"].astype(int)

# Recreate the original test split
_, X_test, _, y_test = train_test_split(
    X,
    y,
    test_size=TEST_SIZE,
    random_state=RANDOM_STATE,
    stratify=y
)

# Transform test data using saved vectorizer
X_test_tfidf = vectorizer.transform(X_test)

# Get fraud probabilities
fraud_probabilities = model.predict_proba(X_test_tfidf)[:, 1]

# Apply production threshold
y_pred = (fraud_probabilities >= THRESHOLD).astype(int)

# Calculate final metrics
metrics = {
    "model": metadata["model_name"],
    "threshold": THRESHOLD,
    "accuracy": accuracy_score(y_test, y_pred),
    "precision": precision_score(y_test, y_pred, zero_division=0),
    "recall": recall_score(y_test, y_pred, zero_division=0),
    "f1_score": f1_score(y_test, y_pred, zero_division=0),
    "roc_auc": roc_auc_score(y_test, fraud_probabilities)
}

print("\nFINAL PRODUCTION MODEL EVALUATION")
print("---------------------------------")

for key, value in metrics.items():
    if isinstance(value, float):
        print(f"{key}: {value:.4f}")
    else:
        print(f"{key}: {value}")

# Save metrics
with open(OUTPUT_DIR / "final_tuned_metrics.json", "w") as file:
    json.dump(metrics, file, indent=4)

pd.DataFrame([metrics]).to_csv(
    OUTPUT_DIR / "final_tuned_metrics.csv",
    index=False
)

# Generate confusion matrix
cm = confusion_matrix(y_test, y_pred)

print("\nCONFUSION MATRIX")
print(cm)

disp = ConfusionMatrixDisplay(
    confusion_matrix=cm,
    display_labels=["Genuine", "Fraudulent"]
)

disp.plot(cmap="Blues", values_format="d")

plt.title(f"Production Model Confusion Matrix\nThreshold = {THRESHOLD:.4f}")
plt.tight_layout()

plt.savefig(
    OUTPUT_DIR / "final_tuned_confusion_matrix.png",
    dpi=300
)

plt.close()

# Save classification report
report = classification_report(
    y_test,
    y_pred,
    target_names=["Genuine", "Fraudulent"],
    output_dict=True,
    zero_division=0
)

pd.DataFrame(report).transpose().to_csv(
    OUTPUT_DIR / "final_classification_report.csv"
)

print("\nEvaluation completed successfully!")
print("All final evaluation files saved in ml/outputs/")
