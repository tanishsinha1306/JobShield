from pathlib import Path

from datetime import datetime, timezone

from contextlib import asynccontextmanager

import json

import os



import joblib

from dotenv import load_dotenv

from pymongo import MongoClient, DESCENDING

from pymongo.errors import PyMongoError

from bson import ObjectId

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field



try:

    from backend.services.fraud_risk_engine import analyze_job_risk

    from backend.services.job_data_extractor import extract_job_data

    from backend.services.company_credibility_engine import analyze_company_credibility
    from backend.services.advanced_job_analysis import analyze_advanced_job
    from backend.services.pdf_report_generator import generate_prediction_pdf

except ModuleNotFoundError:

    from services.fraud_risk_engine import analyze_job_risk

    from services.job_data_extractor import extract_job_data

    from services.company_credibility_engine import analyze_company_credibility
    from services.advanced_job_analysis import analyze_advanced_job
    from services.pdf_report_generator import generate_prediction_pdf





# =====================================================

# 1. PATHS AND ENVIRONMENT

# =====================================================



BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_DIR = BASE_DIR / "ml" / "models"

load_dotenv(BASE_DIR / ".env")



MONGODB_URI = os.getenv("MONGODB_URI")

DATABASE_NAME = os.getenv("MONGODB_DATABASE", "jobshield_ai")



if not MONGODB_URI:

    raise RuntimeError("MONGODB_URI not found in .env file")





# =====================================================

# 2. LOAD EXISTING ML MODEL (UNCHANGED)

# =====================================================



model = joblib.load(MODEL_DIR / "best_model.pkl")

vectorizer = joblib.load(MODEL_DIR / "tfidf_vectorizer.pkl")



with open(MODEL_DIR / "model_metadata.json", "r", encoding="utf-8") as file:

    metadata = json.load(file)



THRESHOLD = float(metadata["threshold"])

FEATURE_NAMES = vectorizer.get_feature_names_out()

COEFFICIENTS = model.coef_[0]





# =====================================================

# 3. MONGODB CONNECTION

# =====================================================



mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)

database = mongo_client[DATABASE_NAME]

predictions_collection = database["predictions"]





# =====================================================

# 4. FASTAPI LIFESPAN

# =====================================================



@asynccontextmanager

async def lifespan(app: FastAPI):

    try:

        mongo_client.admin.command("ping")

        predictions_collection.create_index([("created_at", DESCENDING)])

        print("MongoDB Atlas connected successfully!")

    except PyMongoError as error:

        print(f"MongoDB connection failed: {error}")



    yield



    mongo_client.close()

    print("MongoDB connection closed.")





# =====================================================

# 5. FASTAPI APPLICATION

# =====================================================



app = FastAPI(

    title="JobShield AI API",

    description=(

        "Fake Job Detection using ML, NLP, Explainable AI, Intelligent Fraud "

        "Risk Analysis, Job Data Extraction and Company Credibility Indicators"

    ),

    version="3.4.0",

    lifespan=lifespan,

)



app.add_middleware(

    CORSMiddleware,

    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://[a-z0-9-]+\.vercel\.app$",

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)





# =====================================================

# 6. INPUT SCHEMA

# =====================================================



class JobInput(BaseModel):

    title: str = Field(default="", max_length=300)

    company_profile: str = Field(default="", max_length=10000)

    description: str = Field(default="", max_length=30000)

    requirements: str = Field(default="", max_length=15000)

    benefits: str = Field(default="", max_length=10000)





# =====================================================

# 7. EXPLAINABLE AI

# =====================================================



def explain_prediction(transformed_text, top_n=7):

    row = transformed_text.tocsr()

    indices = row.indices

    values = row.data

    contributions = []



    for index, value in zip(indices, values):

        contribution = float(value * COEFFICIENTS[index])

        contributions.append({

            "term": str(FEATURE_NAMES[index]),

            "contribution": round(contribution, 5),

        })



    risk_signals = sorted(

        [item for item in contributions if item["contribution"] > 0],

        key=lambda item: item["contribution"],

        reverse=True,

    )[:top_n]



    genuine_signals = sorted(

        [item for item in contributions if item["contribution"] < 0],

        key=lambda item: item["contribution"],

    )[:top_n]



    return {

        "risk_signals": risk_signals,

        "genuine_signals": genuine_signals,

        "explanation_method": (

            "TF-IDF feature contributions with Logistic Regression coefficients"

        ),

    }





# =====================================================

# 8. SERIALIZE HISTORY RECORD

# =====================================================



def serialize_prediction(record):

    job_data = record.get("job", {})

    return {

        "id": str(record["_id"]),

        "title": job_data.get("title", ""),

        "company_profile": job_data.get("company_profile", ""),

        "description": job_data.get("description", ""),

        "requirements": job_data.get("requirements", ""),

        "benefits": job_data.get("benefits", ""),

        "prediction": record["prediction"],

        "label": record["label"],

        "fraud_probability": record["fraud_probability"],

        "threshold": record["threshold"],

        "model": record["model"],

        "explanation": record.get("explanation"),

        "risk_assessment": record.get("risk_assessment"),

        "extracted_data": record.get("extracted_data"),

        "company_credibility": record.get("company_credibility"),
        "advanced_job_analysis": record.get("advanced_job_analysis"),

        "created_at": record["created_at"].isoformat(),

    }





# =====================================================

# 9. HOME API

# =====================================================



@app.get("/")

def home():

    return {

        "message": "Welcome to JobShield AI",

        "status": "API Running",

        "version": "3.4.0",

    }





# =====================================================

# 10. HEALTH CHECK

# =====================================================



@app.get("/health")

def health():

    try:

        mongo_client.admin.command("ping")

        database_status = "connected"

    except PyMongoError:

        database_status = "disconnected"



    return {

        "status": "healthy",

        "model": metadata["model_name"],

        "threshold": THRESHOLD,

        "explainable_ai": True,

        "fraud_risk_engine": True,

        "job_data_extractor": True,

        "company_credibility_engine": True,
        "advanced_job_analysis": True,
        "pdf_report_generator": True,

        "database": database_status,

    }





# =====================================================

# 11. PREDICT + EXTRACTION + RISK + COMPANY ANALYSIS

# =====================================================



@app.post("/predict")

def predict_job(job: JobInput):

    try:

        job_data = job.model_dump()

        combined_text = " ".join([

            job.title,

            job.company_profile,

            job.description,

            job.requirements,

            job.benefits,

        ]).lower().strip()



        if len(combined_text) < 20:

            raise HTTPException(

                status_code=400,

                detail="Please provide more job information.",

            )



        # A. Existing ML prediction

        transformed_text = vectorizer.transform([combined_text])

        fraud_probability = float(model.predict_proba(transformed_text)[0][1])

        prediction = int(fraud_probability >= THRESHOLD)

        label = "Potentially Fraudulent" if prediction == 1 else "Likely Genuine"



        # B. Existing Explainable AI

        explanation = explain_prediction(transformed_text)



        # C. Extract email, URL and phone information

        extracted_data = extract_job_data(job_data)



        # D. New Phase 3 company credibility indicators

        company_credibility = analyze_company_credibility(

            job_data,

            extracted_data=extracted_data,

        )



        
        # F. Phase 4 advanced job posting analysis
        advanced_job_analysis = analyze_advanced_job(job_data)
# E. Existing intelligent fraud risk assessment

        risk_assessment = analyze_job_risk(

            job_data,

            ml_probability=fraud_probability,

            extracted_data=extracted_data,

        )



        created_at = datetime.now(timezone.utc)



        # F. Save complete result to MongoDB

        record = {

            "job": job_data,

            "prediction": prediction,

            "label": label,

            "fraud_probability": round(fraud_probability, 4),

            "threshold": THRESHOLD,

            "model": metadata["model_name"],

            "explanation": explanation,

            "risk_assessment": risk_assessment,

            "extracted_data": extracted_data,

            "company_credibility": company_credibility,
            "advanced_job_analysis": advanced_job_analysis,

            "created_at": created_at,

        }

        result = predictions_collection.insert_one(record)



        # G. API response

        return {

            "id": str(result.inserted_id),

            "prediction": prediction,

            "label": label,

            "fraud_probability": round(fraud_probability, 4),

            "threshold": THRESHOLD,

            "model": metadata["model_name"],

            "explanation": explanation,

            "risk_assessment": risk_assessment,

            "extracted_data": extracted_data,

            "company_credibility": company_credibility,
            "advanced_job_analysis": advanced_job_analysis,

            "created_at": created_at.isoformat(),

            "disclaimer": (

                "This is an automated screening result, not proof of fraud. "

                "Verify the employer independently."

            ),

        }



    except HTTPException:

        raise

    except PyMongoError:

        raise HTTPException(

            status_code=503,

            detail="MongoDB is unavailable. Prediction could not be saved.",

        )

    except Exception as error:

        print("Prediction error:", str(error))

        raise HTTPException(

            status_code=500,

            detail="Prediction failed. Please try again.",

        )





# =====================================================

# 12. GET PREDICTION HISTORY

# =====================================================



@app.get("/history")

def get_history(limit: int = 20, skip: int = 0):

    try:

        limit = max(1, min(limit, 100))

        skip = max(0, skip)

        records = list(

            predictions_collection.find()

            .sort("created_at", DESCENDING)

            .skip(skip)

            .limit(limit)

        )

        total = predictions_collection.count_documents({})

        return {

            "total": total,

            "limit": limit,

            "skip": skip,

            "history": [serialize_prediction(record) for record in records],

        }

    except PyMongoError:

        raise HTTPException(

            status_code=503,

            detail="Unable to retrieve prediction history.",

        )





# =====================================================

# 13. DELETE HISTORY RECORD

# =====================================================



@app.delete("/history/{record_id}")

def delete_history(record_id: str):

    try:

        if not ObjectId.is_valid(record_id):

            raise HTTPException(

                status_code=400,

                detail="Invalid history record ID.",

            )



        result = predictions_collection.delete_one({"_id": ObjectId(record_id)})

        if result.deleted_count == 0:

            raise HTTPException(

                status_code=404,

                detail="History record not found.",

            )



        return {

            "message": "Prediction history deleted successfully.",

            "id": record_id,

        }

    except HTTPException:

        raise

    except PyMongoError:

        raise HTTPException(

            status_code=503,

            detail="Unable to delete prediction history.",

        )





# =====================================================

# 14. ANALYTICS

# =====================================================



@app.get("/analytics")

def get_analytics():

    try:

        total = predictions_collection.count_documents({})

        fraudulent = predictions_collection.count_documents({"prediction": 1})

        genuine = predictions_collection.count_documents({"prediction": 0})

        fraud_percentage = round((fraudulent / total) * 100, 2) if total > 0 else 0



        return {

            "total_analyzed": total,

            "fraudulent_jobs": fraudulent,

            "genuine_jobs": genuine,

            "fraud_percentage": fraud_percentage,

        }

    except PyMongoError:

        raise HTTPException(

            status_code=503,

            detail="Unable to retrieve analytics.",

        )



# =====================================================
# 15. DETAILED PDF REPORT
# =====================================================

@app.get("/reports/{record_id}/pdf")
def download_prediction_report(record_id: str):
    try:
        if not ObjectId.is_valid(record_id):
            raise HTTPException(
                status_code=400,
                detail="Invalid report ID.",
            )

        record = predictions_collection.find_one({"_id": ObjectId(record_id)})
        if not record:
            raise HTTPException(
                status_code=404,
                detail="Prediction record not found.",
            )

        pdf_buffer = generate_prediction_pdf(record)
        safe_id = str(record["_id"])
        filename = f"JobShield_AI_Report_{safe_id}.pdf"

        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-store",
            },
        )

    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="Unable to retrieve the prediction report.",
        )
    except Exception as error:
        print("PDF report error:", str(error))
        raise HTTPException(
            status_code=500,
            detail="Unable to generate the PDF report.",
        )

