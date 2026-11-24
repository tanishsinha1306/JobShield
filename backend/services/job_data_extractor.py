import re
from urllib.parse import urlparse


PUBLIC_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "rediffmail.com", "protonmail.com", "icloud.com",
}

SHORTENED_URL_DOMAINS = {
    "bit.ly", "tinyurl.com", "t.co", "cutt.ly",
    "is.gd", "rb.gy", "shorturl.at",
}

EMAIL_PATTERN = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
)

URL_PATTERN = re.compile(
    r"\b(?:https?://|www\.)[^\s<>\"']+",
    re.IGNORECASE,
)

PHONE_PATTERN = re.compile(
    r"(?<!\w)(?:\+?\d{1,3}[-.\s]?)?"
    r"(?:\(?\d{3,5}\)?[-.\s]?)"
    r"\d{3,5}[-.\s]?\d{3,5}(?!\w)"
)


def extract_emails(text):
    return sorted({email.lower() for email in EMAIL_PATTERN.findall(text or "")})


def extract_urls(text):
    cleaned_urls = set()
    for url in URL_PATTERN.findall(text or ""):
        url = url.rstrip(".,;:!?)\"]}")
        if url.lower().startswith("www."):
            url = "https://" + url
        cleaned_urls.add(url)
    return sorted(cleaned_urls)


def extract_phone_numbers(text):
    cleaned_numbers = set()
    for number in PHONE_PATTERN.findall(text or ""):
        digits = re.sub(r"\D", "", number)
        if 10 <= len(digits) <= 13:
            cleaned_numbers.add(number.strip())
    return sorted(cleaned_numbers)


def classify_email(email):
    domain = email.rsplit("@", 1)[-1].lower()
    return {
        "email": email,
        "domain": domain,
        "is_public_email": domain in PUBLIC_EMAIL_DOMAINS,
    }


def classify_url(url):
    parsed = urlparse(url)
    domain = (parsed.hostname or "").lower().removeprefix("www.")
    return {
        "url": url,
        "domain": domain,
        "is_https": parsed.scheme.lower() == "https",
        "is_http": parsed.scheme.lower() == "http",
        "is_shortened": domain in SHORTENED_URL_DOMAINS,
    }


def extract_job_data(job_data):
    fields = [
        "title", "company_profile", "description",
        "requirements", "benefits",
    ]
    combined_text = " ".join(
        str(job_data.get(field) or "") for field in fields
    )

    emails = [classify_email(item) for item in extract_emails(combined_text)]
    urls = [classify_url(item) for item in extract_urls(combined_text)]
    phones = extract_phone_numbers(combined_text)

    return {
        "emails": emails,
        "urls": urls,
        "phone_numbers": phones,
        "summary": {
            "total_emails": len(emails),
            "public_email_count": sum(x["is_public_email"] for x in emails),
            "total_urls": len(urls),
            "http_url_count": sum(x["is_http"] for x in urls),
            "shortened_url_count": sum(x["is_shortened"] for x in urls),
            "total_phone_numbers": len(phones),
        },
    }
