from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)


def _safe(value):
    if value is None:
        return "Not provided"
    text = str(value).strip()
    if not text:
        return "Not provided"
    # Built-in ReportLab fonts do not cover the rupee glyph.
    text = text.replace("₹", "Rs. ")
    return escape(text).replace("\n", "<br/>")


def _paragraph(value, style):
    return Paragraph(_safe(value), style)


def _section(title, story, styles):
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph(_safe(title), styles["Section"]))
    story.append(Spacer(1, 2 * mm))


def _key_value_table(rows, styles):
    data = []
    for label, value in rows:
        data.append([
            Paragraph(f"<b>{_safe(label)}</b>", styles["Small"]),
            Paragraph(_safe(value), styles["BodySmall"]),
        ])
    table = Table(data, colWidths=[48 * mm, 122 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EEF2FF")),
        ("BACKGROUND", (1, 0), (1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9E0EF")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def _signal_table(items, styles, positive=False):
    if not items:
        return Paragraph(
            "No indicators recorded.",
            styles["BodySmall"],
        )

    rows = []
    for item in items:
        if isinstance(item, str):
            signal = item
            explanation = ""
            severity = ""
            points = ""
        else:
            signal = item.get("signal") or item.get("term") or "Indicator"
            explanation = item.get("explanation") or ""
            severity = item.get("severity") or ""
            points_value = item.get("points")
            points = f"{points_value} points" if points_value is not None else ""

        heading = f"<b>{_safe(signal)}</b>"
        metadata = " · ".join(x for x in (severity, points) if x)
        if metadata:
            heading += f"<br/><font size='8' color='#64748B'>{_safe(metadata)}</font>"
        if explanation:
            heading += f"<br/><font size='8' color='#475569'>{_safe(explanation)}</font>"
        rows.append([Paragraph(heading, styles["BodySmall"])])

    table = Table(rows, colWidths=[170 * mm])
    fill = "#ECFDF5" if positive else "#FFF7ED"
    border = "#A7F3D0" if positive else "#FED7AA"
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(fill)),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(border)),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def generate_prediction_pdf(record):
    """Create a detailed PDF report for one saved JobShield AI prediction."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="JobShield AI - Job Screening Report",
        author="JobShield AI",
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="ReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=26,
        textColor=colors.HexColor("#312E81"),
        alignment=TA_CENTER,
        spaceAfter=5,
    ))
    styles.add(ParagraphStyle(
        name="Subtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748B"),
        alignment=TA_CENTER,
        spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        name="Section",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#3730A3"),
        spaceBefore=6,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="BodySmall",
        parent=styles["BodyText"],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B"),
    ))
    styles.add(ParagraphStyle(
        name="Small",
        parent=styles["BodyText"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#475569"),
    ))
    styles.add(ParagraphStyle(
        name="ReportFooter",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748B"),
        alignment=TA_CENTER,
    ))

    job = record.get("job") or {}
    explanation = record.get("explanation") or {}
    risk = record.get("risk_assessment") or {}
    extracted = record.get("extracted_data") or {}
    company = record.get("company_credibility") or {}
    advanced = record.get("advanced_job_analysis") or {}
    salary = advanced.get("salary_analysis") or {}

    created_at = record.get("created_at")
    if isinstance(created_at, datetime):
        created_label = created_at.strftime("%d %b %Y, %I:%M %p UTC")
    else:
        created_label = str(created_at or "Not available")

    probability = float(record.get("fraud_probability") or 0) * 100
    prediction_label = record.get("label") or (
        "Potentially Fraudulent" if record.get("prediction") == 1 else "Likely Genuine"
    )

    story = [
        Paragraph("JobShield AI", styles["ReportTitle"]),
        Paragraph("DETAILED JOB SCREENING & EXPLAINABILITY REPORT", styles["Subtitle"]),
        _key_value_table([
            ("Report ID", str(record.get("_id", "Not available"))),
            ("Generated", datetime.utcnow().strftime("%d %b %Y, %I:%M UTC")),
            ("Analysis date", created_label),
            ("Job title", job.get("title")),
            ("Company information", job.get("company_profile")),
        ], styles),
    ]

    _section("1. Prediction Summary", story, styles)
    story.append(_key_value_table([
        ("Prediction", prediction_label),
        ("Fraud probability", f"{probability:.2f}%"),
        ("Decision threshold", f"{float(record.get('threshold') or 0) * 100:.2f}%"),
        ("ML model", record.get("model")),
        ("Overall risk score", f"{risk.get('risk_score', 'Not available')} / 100"),
        ("Risk level", risk.get("risk_level", "Not available")),
    ], styles))

    _section("2. Job Posting Details", story, styles)
    for label, key in [
        ("Job description", "description"),
        ("Requirements", "requirements"),
        ("Benefits", "benefits"),
    ]:
        story.append(Paragraph(f"<b>{_safe(label)}</b>", styles["BodySmall"]))
        story.append(Spacer(1, 1 * mm))
        story.append(_paragraph(job.get(key), styles["BodySmall"]))
        story.append(Spacer(1, 3 * mm))

    _section("3. Intelligent Fraud Risk Assessment", story, styles)
    story.append(_key_value_table([
        ("Rule-based score", risk.get("rule_based_score", "Not available")),
        ("ML probability", f"{float(risk.get('ml_probability') or 0) * 100:.2f}%"),
        ("Total risk signals", risk.get("total_risk_signals", len(risk.get("risk_signals") or []))),
        ("Total positive signals", risk.get("total_positive_signals", len(risk.get("positive_signals") or []))),
    ], styles))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("<b>Detected risk signals</b>", styles["BodySmall"]))
    story.append(_signal_table(risk.get("risk_signals") or [], styles))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("<b>Positive signals</b>", styles["BodySmall"]))
    story.append(_signal_table(risk.get("positive_signals") or [], styles, positive=True))

    _section("4. Job Data Extraction", story, styles)
    emails = extracted.get("emails") or []
    urls = extracted.get("urls") or []
    phones = extracted.get("phone_numbers") or []
    summary = extracted.get("summary") or {}
    story.append(_key_value_table([
        ("Email addresses", summary.get("total_emails", len(emails))),
        ("Public email providers", summary.get("public_email_count", "Not available")),
        ("URLs", summary.get("total_urls", len(urls))),
        ("Shortened URLs", summary.get("shortened_url_count", "Not available")),
        ("Phone numbers", summary.get("total_phone_numbers", len(phones))),
    ], styles))
    for email in emails:
        if isinstance(email, dict):
            story.append(Paragraph(
                f"Email: {_safe(email.get('email'))} · Domain: {_safe(email.get('domain'))} · "
                f"Public provider: {_safe(email.get('is_public_email'))}",
                styles["BodySmall"],
            ))
    for url in urls:
        if isinstance(url, dict):
            story.append(Paragraph(
                f"URL: {_safe(url.get('url'))} · HTTPS: {_safe(url.get('is_https'))} · "
                f"Shortened: {_safe(url.get('is_shortened'))}",
                styles["BodySmall"],
            ))
    if phones:
        story.append(Paragraph(f"Phone numbers: {_safe(', '.join(map(str, phones)))}", styles["BodySmall"]))

    _section("5. Company Credibility Indicators", story, styles)
    checks = company.get("checks") or {}
    story.append(_key_value_table([
        ("Credibility indicator score", f"{company.get('credibility_score', 'Not available')} / 100"),
        ("Indicator level", company.get("credibility_level", "Not available")),
        ("Company profile supplied", checks.get("company_profile_provided", "Not assessed")),
        ("Website found", checks.get("website_found", "Not assessed")),
        ("HTTPS website found", checks.get("https_website_found", "Not assessed")),
        ("Business email found", checks.get("business_email_found", "Not assessed")),
        ("Email / website domain match", checks.get("email_website_domain_match", "Not assessed")),
        ("Phone number found", checks.get("phone_number_found", "Not assessed")),
    ], styles))
    story.append(Spacer(1, 3 * mm))
    story.append(_signal_table(company.get("positive_signals") or [], styles, positive=True))
    story.append(Spacer(1, 2 * mm))
    story.append(_signal_table(company.get("caution_signals") or [], styles))

    _section("6. Advanced Job Posting Analysis", story, styles)
    completeness = advanced.get("completeness_checks") or {}
    story.append(_key_value_table([
        ("Job quality score", f"{advanced.get('job_quality_score', 'Not available')} / 100"),
        ("Job quality level", advanced.get("job_quality_level", "Not available")),
        ("Review priority", advanced.get("review_priority", "Not available")),
        ("Salary assessment", salary.get("assessment", "Not available")),
        ("Salary mentions", len(salary.get("salary_mentions") or [])),
    ] + [(key.replace("_", " ").title(), value) for key, value in completeness.items()], styles))
    for mention in salary.get("salary_mentions") or []:
        story.append(Paragraph(
            f"Salary amount: Rs. {mention.get('amount_inr', 'Not available')} · "
            f"Period: {_safe(mention.get('period'))} · Context: {_safe(mention.get('text_context'))}",
            styles["BodySmall"],
        ))
    story.append(Spacer(1, 3 * mm))
    story.append(_signal_table(advanced.get("caution_signals") or [], styles))
    story.append(Spacer(1, 2 * mm))
    story.append(_signal_table(advanced.get("positive_signals") or [], styles, positive=True))

    _section("7. Explainable AI - Model Feature Contributions", story, styles)
    story.append(Paragraph(
        _safe(explanation.get("explanation_method") or "Explanation method not available."),
        styles["BodySmall"],
    ))
    for label, key in [
        ("Features increasing fraud log-odds", "risk_signals"),
        ("Features decreasing fraud log-odds", "genuine_signals"),
    ]:
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(f"<b>{_safe(label)}</b>", styles["BodySmall"]))
        items = explanation.get(key) or []
        if items:
            feature_rows = []
            for item in items:
                feature_rows.append([
                    Paragraph(_safe(item.get("term")), styles["BodySmall"]),
                    Paragraph(f"{float(item.get('contribution') or 0):+.5f}", styles["BodySmall"]),
                ])
            feature_table = Table(feature_rows, colWidths=[125 * mm, 45 * mm])
            feature_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(feature_table)
        else:
            story.append(Paragraph("No feature contributions recorded.", styles["BodySmall"]))

    _section("8. Important Disclaimer", story, styles)
    disclaimers = [
        record.get("disclaimer"),
        risk.get("disclaimer"),
        company.get("disclaimer"),
        advanced.get("disclaimer"),
        salary.get("disclaimer"),
    ]
    for disclaimer in disclaimers:
        if disclaimer:
            story.append(Paragraph(_safe(disclaimer), styles["BodySmall"]))
            story.append(Spacer(1, 2 * mm))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "Generated by JobShield AI · Automated screening support only · "
        "Always verify employers independently.",
        styles["ReportFooter"],
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer
