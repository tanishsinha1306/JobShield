
import os
import json
import joblib
import numpy as np
import pandas as pd

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
    classification_report,
    confusion_matrix,
    precision_recall_curve
)


# ==========================================
# JOBSHIELD AI - COMPLETE MODEL TRAINING
# ==========================================

DATA_PATH = "dataset/processed/cleaned_jobs.csv"
MODEL_DIR = "ml/models"
OUTPUT_DIR = "ml/outputs"

RANDOM_STATE = 42
TEST_SIZE = 0.20


# Step 1: Create Directories
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


# Step 2: Load Dataset
print("\nLoading Dataset...")

df = pd.read_csv(DATA_PATH, keep_default_na=False)

if "combined_text" not in df.columns:
    raise ValueError("combined_text column is missing!")

if "fraudulent" not in df.columns:
    raise ValueError("fraudulent target column is missing!")

df["fraudulent"] = pd.to_numeric(
    df["fraudulent"], errors="raise"
).astype(int)

if df["fraudulent"].nunique() != 2:
    raise ValueError("Target must contain both classes!")

X = df["combined_text"].astype(str)
y = df["fraudulent"]

print("Dataset Shape:", df.shape)
print("\nClass Distribution:")
print(y.value_counts())


# Step 3: Train-Test Split
print("\nSplitting Dataset...")

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=TEST_SIZE,
    random_state=RANDOM_STATE,
    stratify=y
)

print("Training Samples:", len(X_train))
print("Testing Samples:", len(X_test))


# Step 4: TF-IDF Vectorization
print("\nApplying TF-IDF...")

tfidf = TfidfVectorizer(
    max_features=10000,
    ngram_range=(1, 2),
    stop_words="english",
    min_df=2,
    sublinear_tf=True
)

X_train_tfidf = tfidf.fit_transform(X_train)
X_test_tfidf = tfidf.transform(X_test)

print("Training Matrix:", X_train_tfidf.shape)
print("Testing Matrix:", X_test_tfidf.shape)


# Step 5: Define ML Models
models = {

    "Logistic Regression": LogisticRegression(
        class_weight="balanced",
        max_iter=1000,
        random_state=RANDOM_STATE
    ),

    "Multinomial Naive Bayes": MultinomialNB(
        alpha=0.5
    ),

    "Random Forest": RandomForestClassifier(
        n_estimators=100,
        max_depth=30,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced_subsample",
        random_state=RANDOM_STATE,
        n_jobs=-1
    )
}


# Step 6: Train and Evaluate Models
results = []
trained_models = {}

print("\n========== MODEL TRAINING ==========")

for name, model in models.items():

    print(f"\nTraining {name}...")

    model.fit(X_train_tfidf, y_train)

    y_pred = model.predict(X_test_tfidf)

    # Probability of fraudulent class
    y_prob = model.predict_proba(X_test_tfidf)[:, 1]

    accuracy = accuracy_score(y_test, y_pred)

    precision = precision_score(
        y_test, y_pred, zero_division=0
    )

    recall = recall_score(
        y_test, y_pred, zero_division=0
    )

    f1 = f1_score(
        y_test, y_pred, zero_division=0
    )

    roc_auc = roc_auc_score(y_test, y_prob)

    trained_models[name] = model

    results.append({
        "Model": name,
        "Accuracy": accuracy,
        "Precision": precision,
        "Recall": recall,
        "F1 Score": f1,
        "ROC AUC": roc_auc
    })

    print("\nClassification Report:")
    print(classification_report(
        y_test,
        y_pred,
        zero_division=0
    ))

    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    print("Accuracy:", round(accuracy, 4))
    print("Precision:", round(precision, 4))
    print("Recall:", round(recall, 4))
    print("F1 Score:", round(f1, 4))
    print("ROC AUC:", round(roc_auc, 4))


# Step 7: Model Comparison
results_df = pd.DataFrame(results)

results_df = results_df.sort_values(
    by="F1 Score",
    ascending=False
)

print("\n========== MODEL COMPARISON ==========")
print(results_df.round(4).to_string(index=False))

results_df.to_csv(
    f"{OUTPUT_DIR}/model_comparison.csv",
    index=False
)


# Step 8: Select Best Model Using Fake-Class F1
best_model_name = results_df.iloc[0]["Model"]

best_model = trained_models[best_model_name]

print("\nBest Model:", best_model_name)


# Step 9: Optimize Classification Threshold
print("\nOptimizing Classification Threshold...")

# Select threshold using a separate validation set
X_train_final, X_val, y_train_final, y_val = train_test_split(
    X_train,
    y_train,
    test_size=0.20,
    random_state=RANDOM_STATE,
    stratify=y_train
)

# Fit vectorizer only on the reduced training data
validation_vectorizer = TfidfVectorizer(
    max_features=10000,
    ngram_range=(1, 2),
    stop_words="english",
    min_df=2,
    sublinear_tf=True
)

X_train_final_tfidf = validation_vectorizer.fit_transform(
    X_train_final
)

X_val_tfidf = validation_vectorizer.transform(X_val)

# Train a validation copy of the selected model
validation_model = joblib.loads(
    joblib.dumps(best_model)
) if False else None

# Clone model with the same parameters
from sklearn.base import clone

validation_model = clone(best_model)

validation_model.fit(X_train_final_tfidf, y_train_final)

val_prob = validation_model.predict_proba(
    X_val_tfidf
)[:, 1]

precisions, recalls, thresholds = precision_recall_curve(
    y_val, val_prob
)

# Select threshold with best F1, subject to minimum precision
threshold_f1 = (
    2 * precisions[:-1] * recalls[:-1]
    / (precisions[:-1] + recalls[:-1] + 1e-10)
)

valid_indices = np.where(precisions[:-1] >= 0.60)[0]

if len(valid_indices) > 0:

    best_index = valid_indices[
        np.argmax(threshold_f1[valid_indices])
    ]

    best_threshold = float(thresholds[best_index])

else:
    best_threshold = 0.50

print("Selected Threshold:", round(best_threshold, 4))


# Step 10: Save Final Model and Vectorizer
# Refit selected model on the complete training split
print("\nSaving Final Model...")

final_model = clone(best_model)
final_model.fit(X_train_tfidf, y_train)

joblib.dump(
    final_model,
    f"{MODEL_DIR}/best_model.pkl"
)

joblib.dump(
    tfidf,
    f"{MODEL_DIR}/tfidf_vectorizer.pkl"
)

# Save threshold and model name
metadata = {
    "model_name": best_model_name,
    "threshold": best_threshold,
    "random_state": RANDOM_STATE,
    "test_size": TEST_SIZE,
    "features": int(X_train_tfidf.shape[1])
}

with open(
    f"{MODEL_DIR}/model_metadata.json",
    "w"
) as file:
    json.dump(metadata, file, indent=4)


# Step 11: Final Test Evaluation at Selected Threshold
test_prob = final_model.predict_proba(
    X_test_tfidf
)[:, 1]

final_predictions = (
    test_prob >= best_threshold
).astype(int)

print("\n========== FINAL MODEL EVALUATION ==========")

print("Selected Model:", best_model_name)
print("Threshold:", round(best_threshold, 4))

print(
    "Accuracy:",
    round(accuracy_score(y_test, final_predictions), 4)
)

print(
    "Precision:",
    round(precision_score(
        y_test, final_predictions, zero_division=0
    ), 4)
)

print(
    "Recall:",
    round(recall_score(
        y_test, final_predictions, zero_division=0
    ), 4)
)

print(
    "F1 Score:",
    round(f1_score(
        y_test, final_predictions, zero_division=0
    ), 4)
)

print("\nFinal Classification Report:")
print(classification_report(
    y_test,
    final_predictions,
    zero_division=0
))

print("Final Confusion Matrix:")
print(confusion_matrix(
    y_test,
    final_predictions
))


# Step 12: Save Final Predictions
prediction_results = pd.DataFrame({
    "actual": y_test.values,
    "predicted": final_predictions,
    "fraud_probability": test_prob
})

prediction_results.to_csv(
    f"{OUTPUT_DIR}/final_predictions.csv",
    index=False
)


print("\n====================================")
print("JOBSHIELD AI TRAINING COMPLETED!")
print("====================================")

print("\nSaved Files:")
print("- ml/models/best_model.pkl")
print("- ml/models/tfidf_vectorizer.pkl")
print("- ml/models/model_metadata.json")
print("- ml/outputs/model_comparison.csv")
print("- ml/outputs/final_predictions.csv")
