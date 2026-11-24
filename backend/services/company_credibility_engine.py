import re
from urllib.parse import urlparse

PUBLIC_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "rediffmail.com", "protonmail.com", "icloud.com",
}


def _domain_from_url(url):
    value = str(url or "").strip()
    if not value:
        return ""
    parsed = urlparse(value if "://" in value else "https://" + value)
    return (parsed.hostname or "").lower().removeprefix("www.")


def _domains_match(email_domain, website_domain):
    if not email_domain or not website_domain:
        return False
    return (
        email_domain == website_domain
        or email_domain.endswith("." + website_domain)
        or website_domain.endswith("." + email_domain)
    )


def analyze_company_credibility(job_data, extracted_data=None):
    """Analyze company-related indicators in submitted job data; does not verify identity."""
    profile = str(job_data.get("company_profile", "") or "").strip()
    extracted_data = extracted_data or {}
    emails = extracted_data.get("emails", []) or []
    urls = extracted_data.get("urls", []) or []
    phones = extracted_data.get("phone_numbers", []) or []

    score = 50
    positive_signals = []
    caution_signals = []
    checks = {
        "company_profile_provided": bool(profile),
        "website_found": bool(urls),
        "https_website_found": any(item.get("is_https") for item in urls),
        "business_email_found": False,
        "email_website_domain_match": None,
        "phone_number_found": bool(phones),
    }

    if not profile:
        score -= 10
        caution_signals.append({
            "signal": "Company profile not provided", "points": -10,
            "explanation": "No company profile was supplied for analysis.",
        })
    elif len(profile) >= 120:
        score += 15
        positive_signals.append({
            "signal": "Detailed company profile", "points": 15,
            "explanation": "The supplied company profile contains useful detail.",
        })
    elif len(profile) >= 40:
        score += 10
        positive_signals.append({
            "signal": "Company profile information provided", "points": 10,
            "explanation": "Some company information is available.",
        })
    else:
        score += 3
        caution_signals.append({
            "signal": "Limited company profile", "points": 3,
            "explanation": "The supplied company profile contains limited detail.",
        })

    email_domains = sorted({
        str(item.get("domain", "")).lower()
        for item in emails if item.get("domain")
    })
    website_domains = sorted({
        _domain_from_url(item.get("url"))
        for item in urls if item.get("url")
    })
    website_domains = [domain for domain in website_domains if domain]

    if website_domains:
        score += 10
        positive_signals.append({
            "signal": "Website URL provided", "points": 10,
            "explanation": "A website URL was included; its existence or ownership has not been verified.",
        })
        if checks["https_website_found"]:
            score += 5
            positive_signals.append({
                "signal": "HTTPS URL provided", "points": 5,
                "explanation": "At least one supplied URL uses HTTPS; this does not establish trustworthiness.",
            })
        else:
            score -= 8
            caution_signals.append({
                "signal": "No HTTPS URL detected", "points": -8,
                "explanation": "The supplied website links do not include an HTTPS URL.",
            })
    else:
        score -= 5
        caution_signals.append({
            "signal": "Website URL not provided", "points": -5,
            "explanation": "No website URL was found in the submitted job information.",
        })

    if email_domains:
        business_domains = [domain for domain in email_domains if domain not in PUBLIC_EMAIL_DOMAINS]
        if business_domains:
            checks["business_email_found"] = True
            score += 10
            positive_signals.append({
                "signal": "Non-public email domain", "points": 10,
                "explanation": "An email using a non-public provider domain was found; ownership is not verified.",
            })
        else:
            score -= 8
            caution_signals.append({
                "signal": "Public email provider", "points": -8,
                "explanation": "Only public email provider domains were found.",
            })

        if website_domains:
            matches = any(
                _domains_match(email_domain, website_domain)
                for email_domain in email_domains
                for website_domain in website_domains
            )
            checks["email_website_domain_match"] = matches
            if matches:
                score += 10
                positive_signals.append({
                    "signal": "Email and website domains match", "points": 10,
                    "explanation": "At least one email domain matches a supplied website domain.",
                })
            else:
                score -= 5
                caution_signals.append({
                    "signal": "Email and website domains differ", "points": -5,
                    "explanation": "The supplied email and website domains differ; this may have legitimate explanations.",
                })
    else:
        score -= 3
        caution_signals.append({
            "signal": "Contact email not provided", "points": -3,
            "explanation": "No email address was found in the submitted job information.",
        })

    if phones:
        score += 3
        positive_signals.append({
            "signal": "Contact phone number provided", "points": 3,
            "explanation": "A phone number was supplied; it has not been validated.",
        })

    score = max(0, min(100, score))
    if score >= 75:
        level = "Stronger indicators"
    elif score >= 50:
        level = "Moderate indicators"
    else:
        level = "Limited indicators"

    return {
        "credibility_score": score,
        "credibility_level": level,
        "positive_signals": positive_signals,
        "caution_signals": caution_signals,
        "checks": checks,
        "assessment_type": "Submitted-information indicator analysis",
        "disclaimer": (
            "This score reflects only the information supplied in the job posting. "
            "It does not verify company registration, website ownership, domain age, "
            "physical address, or employer legitimacy. A higher score is not proof that a company is genuine."
        ),
    }
