import re
from urllib.parse import urlparse

# =====================================================
# JOBSHIELD AI - INTELLIGENT FRAUD RISK ENGINE
# =====================================================

RISK_LEVELS = [
    (25, "Low"),
    (50, "Moderate"),
    (75, "High"),
    (101, "Critical"),
]

FEE_PATTERNS = {
    "registration fee": 25,
    "security deposit": 25,
    "processing fee": 20,
    "pay to apply": 25,
    "application fee": 20,
    "training fee": 20,
    "interview fee": 25,
    "refundable deposit": 20,
    "payment required": 20,
    "pay upfront": 25,
}

SUSPICIOUS_PATTERNS = {
    "guaranteed income": 12,
    "earn money instantly": 15,
    "work from home and earn": 8,
    "no experience required": 5,
    "limited vacancies": 5,
    "urgent hiring": 5,
    "easy money": 12,
    "make money fast": 12,
    "no interview": 10,
    "instant joining": 5,
    "100% guaranteed job": 15,
}

POSITIVE_PATTERNS = {
    "official company website": 5,
    "equal opportunity employer": 3,
    "background verification": 3,
    "interview process": 3,
    "job responsibilities": 2,
}

PUBLIC_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "rediffmail.com", "protonmail.com", "icloud.com",
}

SHORTENED_URL_DOMAINS = {
    "bit.ly", "tinyurl.com", "t.co", "cutt.ly",
    "is.gd", "rb.gy", "shorturl.at",
}


def normalize_text(value):
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value.lower()).strip()


def get_risk_level(score):
    for limit, level in RISK_LEVELS:
        if score < limit:
            return level
    return "Critical"


def analyze_fees(text):
    signals, score = [], 0
    for phrase, weight in FEE_PATTERNS.items():
        if phrase in text:
            score += weight
            signals.append({
                "category": "Financial Request",
                "signal": phrase,
                "severity": "High",
                "points": weight,
                "explanation": (
                    "The job posting mentions a payment or deposit requirement. "
                    "Verify independently."
                ),
            })
    return score, signals


def analyze_suspicious_keywords(text):
    signals, score = [], 0
    for phrase, weight in SUSPICIOUS_PATTERNS.items():
        if phrase in text:
            score += weight
            signals.append({
                "category": "Suspicious Language",
                "signal": phrase,
                "severity": "Medium",
                "points": weight,
                "explanation": (
                    "This phrase may indicate an unrealistic or misleading job offer."
                ),
            })
    return score, signals


def analyze_company_information(company_profile):
    signals, score = [], 0
    company_text = normalize_text(company_profile)

    if not company_text:
        score += 10
        signals.append({
            "category": "Company Information",
            "signal": "Missing company profile",
            "severity": "Low",
            "points": 10,
            "explanation": "No company profile information was provided.",
        })
    elif len(company_text) < 40:
        score += 5
        signals.append({
            "category": "Company Information",
            "signal": "Limited company information",
            "severity": "Low",
            "points": 5,
            "explanation": "The company profile contains limited information.",
        })

    return score, signals


def analyze_email(text):
    signals, score = [], 0
    emails = re.findall(
        r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
        text,
        flags=re.IGNORECASE,
    )

    for email in set(emails):
        domain = email.rsplit("@", 1)[-1].lower()
        if domain in PUBLIC_EMAIL_DOMAINS:
            score += 8
            signals.append({
                "category": "Email Verification",
                "signal": "Public email domain",
                "severity": "Low",
                "points": 8,
                "explanation": (
                    "A personal email provider is being used. This is not proof "
                    "of fraud; verify the employer."
                ),
            })

    return score, signals


def analyze_urls(text):
    signals, score = [], 0
    urls = re.findall(
        r"https?://[^\s<>\"']+|www\.[^\s<>\"']+",
        text,
        flags=re.IGNORECASE,
    )

    for raw_url in urls:
        clean_url = raw_url.rstrip(".,;:!?)\"]}")
        normalized_url = (
            clean_url if "://" in clean_url else "https://" + clean_url
        )
        parsed = urlparse(normalized_url)
        domain = (parsed.hostname or "").lower().removeprefix("www.")

        if parsed.scheme.lower() == "http":
            score += 8
            signals.append({
                "category": "Website Security",
                "signal": "Non-HTTPS URL",
                "severity": "Medium",
                "points": 8,
                "explanation": (
                    "The provided URL does not use HTTPS. Check the website "
                    "carefully before sharing data."
                ),
            })

        if domain in SHORTENED_URL_DOMAINS:
            score += 10
            signals.append({
                "category": "Website Security",
                "signal": "Shortened URL",
                "severity": "Medium",
                "points": 10,
                "explanation": (
                    "A shortened URL hides the destination. Verify its final "
                    "destination before opening."
                ),
            })

    return score, signals


def analyze_positive_signals(text):
    signals, score = [], 0
    for phrase, weight in POSITIVE_PATTERNS.items():
        if phrase in text:
            score += weight
            signals.append({
                "category": "Positive Signal",
                "signal": phrase,
                "points": weight,
                "explanation": (
                    "This information provides useful context, but does not "
                    "independently verify the employer."
                ),
            })
    return score, signals


def analyze_job_risk(job_data, ml_probability=None, extracted_data=None):
    title = normalize_text(job_data.get("title", ""))
    company = normalize_text(job_data.get("company_profile", ""))
    description = normalize_text(job_data.get("description", ""))
    requirements = normalize_text(job_data.get("requirements", ""))
    benefits = normalize_text(job_data.get("benefits", ""))

    full_text = " ".join([title, company, description, requirements, benefits])

    fee_score, fee_signals = analyze_fees(full_text)
    keyword_score, keyword_signals = analyze_suspicious_keywords(full_text)
    company_score, company_signals = analyze_company_information(company)
    email_score, email_signals = analyze_email(full_text)
    url_score, url_signals = analyze_urls(full_text)
    positive_score, positive_signals = analyze_positive_signals(full_text)

    signals = (
        fee_signals + keyword_signals + company_signals
        + email_signals + url_signals
    )

    # Add extracted-data checks only when extraction is supplied.
    if extracted_data:
        summary = extracted_data.get("summary", {})
        # Avoid duplicate signals: only add a signal if the existing text
        # analyzer did not already detect the corresponding category.
        if summary.get("public_email_count", 0) and not email_signals:
            signals.append({
                "category": "Email Verification",
                "signal": "Public email domain",
                "severity": "Low",
                "points": 8,
                "explanation": (
                    "A public email provider was found. This is not proof of "
                    "fraud; verify the employer independently."
                ),
            })
            email_score += 8

        if summary.get("http_url_count", 0) and not any(
            item["signal"] == "Non-HTTPS URL" for item in url_signals
        ):
            signals.append({
                "category": "Website Security",
                "signal": "Non-HTTPS URL",
                "severity": "Medium",
                "points": 8,
                "explanation": "A non-HTTPS URL was detected. Verify it before use.",
            })
            url_score += 8

        if summary.get("shortened_url_count", 0) and not any(
            item["signal"] == "Shortened URL" for item in url_signals
        ):
            signals.append({
                "category": "Website Security",
                "signal": "Shortened URL",
                "severity": "Medium",
                "points": 10,
                "explanation": "A shortened URL hides its destination.",
            })
            url_score += 10

    rule_score = max(
        0,
        min(
            100,
            fee_score + keyword_score + company_score
            + email_score + url_score - positive_score,
        ),
    )

    if ml_probability is not None:
        ml_probability = max(0.0, min(1.0, float(ml_probability)))
        combined_score = (ml_probability * 100 * 0.60) + (rule_score * 0.40)
    else:
        combined_score = float(rule_score)

    final_score = round(max(0, min(100, combined_score)), 2)

    return {
        "risk_score": final_score,
        "risk_level": get_risk_level(final_score),
        "rule_based_score": rule_score,
        "ml_probability": (
            round(ml_probability, 4) if ml_probability is not None else None
        ),
        "risk_signals": signals,
        "positive_signals": positive_signals,
        "total_risk_signals": len(signals),
        "total_positive_signals": len(positive_signals),
        "disclaimer": (
            "This risk assessment is an automated screening aid, not proof "
            "of fraud. Verify the employer independently."
        ),
    }
