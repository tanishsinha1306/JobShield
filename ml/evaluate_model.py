
from pathlib import Path
import json
import joblib
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import RandomForestClassifier

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    ConfusionMatrixDisplay,
    roc_curve,
    precision_recall_curve
)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "dataset" / "processed" / "cleaned_jobs.csv"
MODEL_DIR = BASE_DIR / "ml" / "models"
OUTPUT_DIR = BASE_DIR / "ml" / "outputs"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("Loading dataset...")

df = pd.read_csv(DATA_PATH, keep_default_na=False)

X = df["combined_text"].astype(str)
y = df["fraudulent"].astype(int)

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("Creating TF-IDF features...")

vectorizer = TfidfVectorizer(
    max_features=10000,
    ngram_range=(1, 2),
    stop_words="english",
    min_df=2,
    sublinear_tf=True
)

X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)

models = {
    "Logistic Regression": LogisticRegression(
        class_weight="balanced",
        max_iter=1000,
        random_state=42
    ),
    "Naive Bayes": MultinomialNB(alpha=0.5),
    "Random Forest": RandomForestClassifier(
        n_estimators=100,
        max_depth=30,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced_subsample",
        random_state=42,
        n_jobs=-1
    )
}

results = []
predictions = {}

print("\nEvaluating models...")

for name, model in models.items():

    print(f"Training {name}...")

    model.fit(X_train_tfidf, y_train)

    y_pred = model.predict(X_test_tfidf)
    y_prob = model.predict_proba(X_test_tfidf)[:, 1]

    predictions[name] = {
        "model": model,
        "pred": y_pred,
        "prob": y_prob
    }

    results.append({
        "Model": name,
        "Accuracy": accuracy_score(y_test, y_pred),
        "Precision": precision_score(y_test, y_pred, zero_division=0),
        "Recall": recall_score(y_test, y_pred, zero_division=0),
        "F1 Score": f1_score(y_test, y_pred, zero_division=0),
        "ROC AUC": roc_auc_score(y_test, y_prob)
    })

results_df = pd.DataFrame(results)

results_df.to_csv(
    OUTPUT_DIR / "evaluation_metrics.csv",
    index=False
)

print("\nMODEL COMPARISON")
print(results_df.round(4).to_string(index=False))

# 1. Confusion Matrix for Logistic Regression
lr_pred = predictions["Logistic Regression"]["pred"]

cm = confusion_matrix(y_test, lr_pred)

disp = ConfusionMatrixDisplay(
    confusion_matrix=cm,
    display_labels=["Genuine", "Fraudulent"]
)

disp.plot(cmap="Blues", values_format="d")
plt.title("Logistic Regression - Confusion Matrix")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "confusion_matrix.png", dpi=300)
plt.close()

# 2. ROC Curve
plt.figure(figsize=(8, 6))

for name, data in predictions.items():

    fpr, tpr, _ = roc_curve(y_test, data["prob"])
    auc = roc_auc_score(y_test, data["prob"])

    plt.plot(fpr, tpr, label=f"{name} (AUC = {auc:.3f})")

plt.plot([0, 1], [0, 1], linestyle="--", label="Random Classifier")
plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.title("ROC Curve - Model Comparison")
plt.legend()
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "roc_curve.png", dpi=300)
plt.close()

# 3. Precision Recall Curve
plt.figure(figsize=(8, 6))

for name, data in predictions.items():

    precision, recall, _ = precision_recall_curve(
        y_test,
        data["prob"]
    )

    plt.plot(recall, precision, label=name)

plt.xlabel("Recall")
plt.ylabel("Precision")
plt.title("Precision-Recall Curve")
plt.legend()
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "precision_recall_curve.png", dpi=300)
plt.close()

# 4. Model Comparison Graph
metrics = ["Accuracy", "Precision", "Recall", "F1 Score", "ROC AUC"]

results_df.set_index("Model")[metrics].plot(
    kind="bar",
    figsize=(11, 6),
    ylim=(0, 1.05)
)

plt.title("Machine Learning Model Comparison")
plt.ylabel("Score")
plt.xticks(rotation=0)
plt.legend(loc="lower right")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "model_comparison.png", dpi=300)
plt.close()

# 5. Dataset Class Distribution
class_counts = y.value_counts().sort_index()

plt.figure(figsize=(7, 5))
plt.bar(
    ["Genuine", "Fraudulent"],
    [class_counts.get(0, 0), class_counts.get(1, 0)]
)

plt.title("Dataset Class Distribution")
plt.ylabel("Number of Job Postings")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "class_distribution.png", dpi=300)
plt.close()

print("\nEvaluation completed successfully!")

print("\nGenerated files:")

for file in sorted(OUTPUT_DIR.iterdir()):
    if file.is_file():
        print(file.name)