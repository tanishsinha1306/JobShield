import re
from typing import Any


# Salary amounts are accepted only when the surrounding text indicates
# compensation. Fee/deposit/payment amounts are deliberately excluded.
AMOUNT_PATTERNS = [
    re.compile(
        r"(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.\d+)?)\s*"
        r"(lakh|lakhs|lac|lacs|k)?\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b([0-9][0-9,]*(?:\.\d+)?)\s*"
        r"(lakh|lakhs|lac|lacs|k)\b",
        re.IGNORECASE,
    ),
]

SALARY_CONTEXT_TERMS = (
    "salary",
    "monthly salary",
    "annual salary",
    "pay",
    "compensation",
    "ctc",
    "remuneration",
    "stipend",
    "gross",
    "take home",
    "per month",
    "monthly",
    "/month",
    "a month",
    "per annum",
    "annually",
    "per year",
    "/year",
    "lpa",
    "per hour",
    "hourly",
)

NON_SALARY_CONTEXT_PATTERNS = (
    r"\bregistration\s+fee\b",
    r"\bapplication\s+fee\b",
    r"\bsecurity\s+deposit\b",
    r"\brefundable\s+deposit\b",
    r"\bprocessing\s+fee\b",
    r"\binterview\s+fee\b",
    r"\btraining\s+fee\b",
    r"\bjoining\s+fee\b",
    r"\bpayment\s+required\b",
    r"\bpay\s+(?:a|the|your)?\s*(?:registration|application|processing|interview|training|joining)\s+fee\b",
    r"\bdeposit\b",
)

MONTH_WORDS = ("per month", "monthly", "/month", "a month", "pm")
YEAR_WORDS = ("per annum", "annually", "per year", "/year", "p.a.", "pa ", "lpa")

RESPONSIBILITY_TERMS = (
    "responsibilities",
    "job duties",
    "role and responsibilities",
    "you will",
    "key duties",
    "what you will do",
)
QUALIFICATION_TERMS = (
    "qualification",
    "qualifications",
    "education",
    "degree",
    "eligibility",
    "graduate",
    "12th pass",
)
EXPERIENCE_TERMS = ("experience", "fresher", "years of", "year of", "work experience")
LOCATION_TERMS = (
    "location",
    "work from home",
    "remote",
    "hybrid",
    "on-site",
    "onsite",
    "city",
    "address",
)
EMPLOYMENT_TERMS = (
    "full-time",
    "part-time",
    "contract",
    "internship",
    "permanent",
    "temporary",
    "freelance",
)


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", value.lower()).strip() if isinstance(value, str) else ""


def _has_any(text: str, terms) -> bool:
    return any(term in text for term in terms)


def _salary_values(text: str):
    """Extract distinct compensation amounts, excluding fees and deposits."""
    values = []
    non_salary_patterns = [
        re.compile(pattern, re.IGNORECASE)
        for pattern in NON_SALARY_CONTEXT_PATTERNS
    ]

    for pattern in AMOUNT_PATTERNS:
        for match in pattern.finditer(text):
            raw = match.group(1).replace(",", "")
            try:
                amount = float(raw)
            except ValueError:
                continue

            unit = (match.group(2) or "").strip().lower()
            if unit in {"lakh", "lakhs", "lac", "lacs"}:
                amount *= 100000
            elif unit == "k":
                amount *= 1000

            # Inspect the local context around this amount, not the entire
            # posting. This prevents an unrelated salary phrase elsewhere
            # from making a registration fee look like compensation.
            context_start = max(0, match.start() - 90)
            context_end = min(len(text), match.end() + 90)
            context = text[context_start:context_end]

            if any(p.search(context) for p in non_salary_patterns):
                continue

            if not _has_any(context, SALARY_CONTEXT_TERMS):
                continue

            if amount <= 0:
                continue

            month_context = _has_any(context, MONTH_WORDS)
            year_context = _has_any(context, YEAR_WORDS)

            # Prefer the closest/local period indicator.
            if month_context and not year_context:
                period = "monthly"
            elif year_context and not month_context:
                period = "annual"
            elif month_context and year_context:
                period = "annual" if "lpa" in context or "per annum" in context else "monthly"
            else:
                period = "unspecified"

            values.append(
                {
                    "amount": int(amount),
                    "period": period,
                    "start": match.start(),
                    "end": match.end(),
                    "context": context.strip(),
                }
            )

    # Remove overlapping regex matches and repeated salary figures that
    # appear again in another section (for example Description and Benefits).
    unique = {}
    for item in values:
        key = (item["amount"], item["period"])
        if key not in unique:
            unique[key] = item

    return list(unique.values())


def analyze_advanced_job(job_data: dict) -> dict:
    title = _text(job_data.get("title"))
    description = _text(job_data.get("description"))
    requirements = _text(job_data.get("requirements"))
    benefits = _text(job_data.get("benefits"))
    company = _text(job_data.get("company_profile"))
    full_text = " ".join([title, company, description, requirements, benefits])

    cautions = []
    positives = []
    quality_score = 100

    # Salary analysis
    salary_items = _salary_values(full_text)
    salary_analysis = {
        "salary_found": bool(salary_items),
        "salary_mentions": [],
        "assessment": "Not stated",
        "disclaimer": (
            "Salary flags are heuristic indicators, not proof of fraud "
            "or a market-rate verification."
        ),
    }

    for item in salary_items:
        amount = item["amount"]
        period = item["period"]

        salary_analysis["salary_mentions"].append(
            {
                "amount_inr": amount,
                "period": period,
                "text_context": item["context"],
            }
        )

        if period == "monthly" and amount >= 300000:
            cautions.append(
                {
                    "category": "Salary realism",
                    "signal": "Unusually high monthly salary claim",
                    "severity": "High",
                    "points": 18,
                    "explanation": (
                        "The stated monthly amount is unusually high and "
                        "should be independently checked."
                    ),
                }
            )
            salary_analysis["assessment"] = "Review recommended"
        elif period == "annual" and amount >= 5000000:
            cautions.append(
                {
                    "category": "Salary realism",
                    "signal": "Very high annual salary claim",
                    "severity": "Medium",
                    "points": 12,
                    "explanation": (
                        "The stated annual amount is high; verify the role, "
                        "employer and compensation details."
                    ),
                }
            )
            salary_analysis["assessment"] = "Review recommended"
        elif amount > 0:
            positives.append(
                {
                    "signal": "Salary information provided",
                    "explanation": (
                        "A compensation figure is present, but it has not "
                        "been independently verified."
                    ),
                }
            )
            if salary_analysis["assessment"] == "Not stated":
                salary_analysis["assessment"] = "Amount stated; not verified"

    # Check whether essential job details are described.
    fields = {
        "job_responsibilities": bool(
            description and _has_any(description, RESPONSIBILITY_TERMS)
        ),
        "qualifications": bool(
            _has_any(requirements + " " + description, QUALIFICATION_TERMS)
        ),
        "experience_expectations": bool(
            _has_any(requirements + " " + description, EXPERIENCE_TERMS)
        ),
        "work_location_or_mode": bool(_has_any(full_text, LOCATION_TERMS)),
        "employment_type": bool(_has_any(full_text, EMPLOYMENT_TERMS)),
    }

    missing = [name for name, present in fields.items() if not present]
    for name in missing:
        quality_score -= 10
        cautions.append(
            {
                "category": "Job information completeness",
                "signal": f"Missing or unclear {name.replace('_', ' ')}",
                "severity": "Low",
                "points": 5,
                "explanation": (
                    "The posting does not clearly state this detail. "
                    "Ask the employer for clarification."
                ),
            }
        )

    if not missing:
        positives.append(
            {
                "signal": "Core job details are described",
                "explanation": (
                    "The posting includes the checked role, qualification, "
                    "experience, location and employment details."
                ),
            }
        )

    # Hiring claims that merit scrutiny. Existing Phase 1 rules remain unchanged.
    hiring_patterns = [
        (r"\bno interview\b", "No interview process mentioned", 8),
        (
            r"\bguaranteed (?:job|selection|income)\b",
            "Guaranteed job or selection claim",
            8,
        ),
        (
            r"\binstant joining\b|\bjoin immediately\b",
            "Immediate joining claim",
            4,
        ),
        (
            r"\bno experience required\b",
            "No experience required claim",
            3,
        ),
    ]

    for pattern, label, points in hiring_patterns:
        if re.search(pattern, full_text):
            cautions.append(
                {
                    "category": "Hiring pattern",
                    "signal": label,
                    "severity": "Medium" if points >= 8 else "Low",
                    "points": points,
                    "explanation": (
                        "This claim is not automatically fraudulent, but "
                        "should be checked against the role and employer."
                    ),
                }
            )

    quality_score = max(0, min(100, quality_score))
    caution_points = sum(item["points"] for item in cautions)

    if caution_points >= 25:
        review_level = "High review priority"
    elif caution_points >= 10:
        review_level = "Moderate review priority"
    else:
        review_level = "Low review priority"

    return {
        "job_quality_score": quality_score,
        "job_quality_level": (
            "Good"
            if quality_score >= 80
            else "Fair"
            if quality_score >= 60
            else "Needs improvement"
        ),
        "review_priority": review_level,
        "salary_analysis": salary_analysis,
        "completeness_checks": fields,
        "missing_information": missing,
        "caution_signals": cautions,
        "positive_signals": positives,
        "total_caution_signals": len(cautions),
        "total_positive_signals": len(positives),
        "disclaimer": (
            "This is a text-based screening aid. Salary figures, job details "
            "and hiring claims are not independently verified; a missing "
            "detail or unusual claim is not proof of fraud."
        ),
    }
