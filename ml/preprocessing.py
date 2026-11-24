
import os
import pandas as pd

# ==========================================
# JOBSHIELD AI - DATA PREPROCESSING
# ==========================================

# Dataset paths
DATA_PATH = "dataset/fake_job_postings.csv"
OUTPUT_PATH = "dataset/processed/cleaned_jobs.csv"


# Step 1: Load Dataset
def load_data():

    df = pd.read_csv(DATA_PATH)

    print("\nOriginal Dataset Shape:", df.shape)

    return df


# Step 2: Clean Dataset
def clean_data(df):

    # Remove duplicate records
    df = df.drop_duplicates().copy()

    # Text columns
    text_columns = [
        "title",
        "company_profile",
        "description",
        "requirements",
        "benefits"
    ]

    # Fill missing text values
    for col in text_columns:
        df[col] = df[col].fillna("").astype(str)

    # Categorical columns
    categorical_columns = [
        "location",
        "department",
        "salary_range",
        "employment_type",
        "required_experience",
        "required_education",
        "industry",
        "function"
    ]

    # Fill missing categorical values
    for col in categorical_columns:
        df[col] = df[col].fillna("Unknown")

    # Handle remaining missing values
    for col in df.columns:

        if col == "fraudulent":
            continue

        if df[col].isnull().any():
            df[col] = df[col].fillna("Unknown")

    print("\nData Cleaning Completed!")
    print("Cleaned Dataset Shape:", df.shape)
    print("Missing Values:", df.isnull().sum().sum())

    return df


# Step 3: Prepare Text Data for NLP
def prepare_text(df):

    text_columns = [
        "title",
        "company_profile",
        "description",
        "requirements",
        "benefits"
    ]

    # Ensure text columns contain strings
    for col in text_columns:
        df[col] = df[col].fillna("").astype(str)

    # Combine all important text fields
    df["combined_text"] = (
        df[text_columns]
        .agg(" ".join, axis=1)
        .str.lower()
        .str.strip()
    )

    print("\nText Preparation Completed!")

    print("\nSample Combined Text:")
    print(df["combined_text"].iloc[0][:500])

    return df


# Step 4: Save Processed Dataset
def save_data(df):

    # Create processed folder if it does not exist
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    # Save cleaned dataset
    df.to_csv(OUTPUT_PATH, index=False)

    print("\nProcessed Dataset Saved Successfully!")
    print("File Location:", OUTPUT_PATH)


# ==========================================
# MAIN EXECUTION
# ==========================================

if __name__ == "__main__":

    # Load original dataset
    df = load_data()

    # Clean missing values
    df = clean_data(df)

    # Prepare combined text for NLP
    df = prepare_text(df)

    # Save final processed dataset
    save_data(df)

    print("\nFirst 5 Rows:")
    print(df.head())

    print("\nFinal Dataset Shape:", df.shape)

    print("\nJOBSHIELD AI PREPROCESSING COMPLETED!")
