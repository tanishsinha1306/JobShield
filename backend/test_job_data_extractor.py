
from services.job_data_extractor import extract_job_data


sample_job = {
    "title": "Work From Home Data Entry Executive",

    "company_profile": (
        "ABC Technologies. Contact us at "
        "abctech@gmail.com"
    ),

    "description": (
        "Apply now at http://bit.ly/job-apply "
        "or visit https://abctech.example.com. "
        "Call +91 9876543210."
    ),

    "requirements": "Basic computer knowledge.",

    "benefits": "Earn money from home.",
}


result = extract_job_data(sample_job)

print("\nJOB DATA EXTRACTION TEST")
print("========================")

print("\nEmails:")
for item in result["emails"]:
    print(item)

print("\nURLs:")
for item in result["urls"]:
    print(item)

print("\nPhone Numbers:")
for number in result["phone_numbers"]:
    print(number)

print("\nSummary:")
print(result["summary"])
