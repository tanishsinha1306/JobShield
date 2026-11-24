
from services.fraud_risk_engine import analyze_job_risk

genuine_job = {
    "title": "Software Engineer",
    "company_profile": (
        "Established technology company developing "
        "enterprise software solutions for global clients."
    ),
    "description": (
        "We are hiring a Software Engineer. "
        "Candidates will participate in a structured "
        "technical interview process and background verification."
    ),
    "requirements": (
        "Bachelor degree in Computer Science. "
        "Knowledge of Python, JavaScript and databases."
    ),
    "benefits": (
        "Health insurance, paid leave and equal opportunity employer."
    )
}

result = analyze_job_risk(
    genuine_job,
    ml_probability=0.10
)

print("\nGENUINE JOB RISK TEST")
print("=====================")

print("Risk Score:", result["risk_score"])
print("Risk Level:", result["risk_level"])

print("\nDetected Risk Signals:")

for signal in result["risk_signals"]:
    print("-", signal["signal"])

print("\nPositive Signals:")

for signal in result["positive_signals"]:
    print("-", signal["signal"])
