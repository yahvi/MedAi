"""
Gemini 3.8 Flash AI Service (using the modern google-genai Interactions API).

Covers:
- Module 2: Multimodal PDF/Image Medical Report Extraction & Analysis
- Module 3: Simplified Medical Report (English & Hindi)
- Module 4: Dr. Sehat Conversational Medical Assistant (report-aware, stateful)
- Graceful Demo Mode when GEMINI_API_KEY is not yet configured.
"""

from __future__ import annotations

import base64
import json
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from config import Config
from services.clinical_rules import evaluate_clinical_alerts


# ---------- Pydantic Schemas for Structured Outputs ----------


class ExtractedTestItem(BaseModel):
    test_name: str = Field(description="Standardized name of the lab test (e.g., Hemoglobin, Fasting Glucose).")
    result: str = Field(description="Extracted measured value as shown in the report.")
    unit: str = Field(default="", description="Unit of measurement (e.g., g/dL, mg/dL, %, mIU/L).")
    normal_range: str = Field(description="Reference range printed in the report, or 'Not listed'.")
    status: str = Field(description="One of: Normal, Low, High, Borderline, Unknown.")
    explanation_en: str = Field(description="Simple, jargon-free 1-2 sentence explanation in English of what this test measures and what this result means.")
    explanation_hi: str = Field(description="Simple, natural 1-2 sentence explanation in Hindi (Devanagari) preserving medical accuracy.")


class MedicalTermExplanation(BaseModel):
    term: str = Field(description="Complex medical term found in the report.")
    simple_en: str = Field(description="Plain-language English explanation.")
    simple_hi: str = Field(description="Plain-language Hindi explanation.")


class ReportAnalysisSchema(BaseModel):
    report_title: str = Field(description="Short descriptive title (e.g., Complete Blood Count & Metabolic Panel).")
    report_date: str = Field(default="", description="Date printed on report (YYYY-MM-DD or as shown), or empty string.")
    lab_name: str = Field(default="", description="Laboratory or clinic name if visible, else empty string.")
    tests: List[ExtractedTestItem] = Field(description="All lab test rows extracted from the report.")
    summary_en: str = Field(description="Warm, patient-friendly overall summary in plain English (3-5 sentences).")
    summary_hi: str = Field(description="Warm, patient-friendly overall summary in plain Hindi (3-5 sentences).")
    normal_highlights_en: List[str] = Field(description="Bullet points highlighting results that are within normal range (English).")
    normal_highlights_hi: List[str] = Field(description="Bullet points highlighting results within normal range (Hindi).")
    attention_points_en: List[str] = Field(description="Bullet points explaining results that need attention (English).")
    attention_points_hi: List[str] = Field(description="Bullet points explaining results that need attention (Hindi).")
    doctor_discussion_points_en: List[str] = Field(description="3-5 practical questions or points the patient should discuss with their doctor (English).")
    doctor_discussion_points_hi: List[str] = Field(description="3-5 practical questions or points to discuss with their doctor (Hindi).")
    simplified_terms: List[MedicalTermExplanation] = Field(description="Key medical terms from this report explained simply in English and Hindi.")


# ---------- System Prompts ----------

REPORT_ANALYSIS_SYSTEM_INSTRUCTION = """You are MedAi, a careful medical communication assistant that extracts and explains laboratory and diagnostic reports for patients in plain, reassuring language.

CRITICAL SAFETY RULES:
1. Extract ONLY values, units, and reference ranges actually present in the uploaded document. Never invent test results.
2. Compare each test value strictly against the reference range shown on the report and classify as Normal, Low, High, Borderline, or Unknown.
3. Explain medical terminology clearly in BOTH simple English and natural, accurate Hindi (Devanagari script) while preserving medical meaning.
4. NEVER diagnose a disease, NEVER prescribe or recommend medicines, and NEVER tell a patient to stop, skip, or alter prescribed medication.
5. Do NOT label results as medical emergencies on your own; focus on factual, calm explanation and recommend reviewing out-of-range findings with a qualified doctor.
6. If any part of the uploaded image/PDF is blurry or unreadable, state clearly that it could not be read rather than guessing.
"""

DR_SEHAT_SYSTEM_INSTRUCTION = """You are Dr. Sehat, a warm, empathetic AI medical communication assistant built into MedAi.

YOUR ROLE:
- Explain medical terms, lab test results, and general health concepts in clear, simple language that any patient can understand.
- When a patient shares their uploaded lab report context, reference their specific extracted values accurately and explain what those tests measure.
- Respond in the requested language (English or natural Hindi in Devanagari script; if the user writes in Hinglish or Hindi, respond clearly in the requested language).

STRICT SAFETY BOUNDARIES (ALWAYS FOLLOW):
1. NEVER diagnose a disease or confirm a medical condition.
2. NEVER prescribe medicines or recommend specific drug dosages.
3. NEVER advise a patient to start, stop, reduce, or change any prescribed medication or treatment.
4. If the patient describes severe/emergency symptoms (e.g., chest pain, severe shortness of breath, sudden weakness/numbness, fainting, severe bleeding, suicidal thoughts), calmly urge them to seek immediate in-person emergency medical care or call emergency services.
5. Encourage discussing personalized findings and treatment questions with a qualified doctor.
6. Keep answers well-structured, concise, reassuring, and easy to read aloud.
"""


def is_gemini_configured() -> bool:
    return bool(Config.GEMINI_API_KEY)


def _get_client():
    from google import genai  # Lazy import so app boots cleanly

    return genai.Client(api_key=Config.GEMINI_API_KEY)


FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]


def create_interaction_with_fallback(**kwargs: Any) -> Any:
    """
    Calls client.interactions.create with Config.GEMINI_MODEL first, and automatically
    falls back to current high-availability Flash-Lite models on temporary 503/429 demand spikes.
    """
    client = _get_client()
    primary = kwargs.pop("model", None) or Config.GEMINI_MODEL
    candidates = [primary] + [m for m in FALLBACK_MODELS if m != primary]

    last_exc: Optional[Exception] = None
    for idx, model_name in enumerate(candidates):
        call_kwargs = dict(kwargs)
        call_kwargs["model"] = model_name
        # previous_interaction_id may be tied to the prior model; drop on fallback switch
        if idx > 0:
            call_kwargs.pop("previous_interaction_id", None)
        try:
            return client.interactions.create(**call_kwargs)
        except Exception as exc:
            msg = str(exc).lower()
            transient = any(
                k in msg
                for k in (
                    "503",
                    "429",
                    "high demand",
                    "service_unavailable",
                    "unavailable",
                    "overloaded",
                    "resource_exhausted",
                )
            )
            last_exc = exc
            if not transient or idx == len(candidates) - 1:
                raise
            print(f"[MedAi] {model_name} busy ({exc}); falling back to {candidates[idx + 1]}...")
    raise last_exc  # type: ignore[misc]


def _build_demo_report_analysis(file_name: str, variant: str = "standard") -> Dict[str, Any]:
    """Produces a realistic, rich sample analysis so users can test all Phase 1 workflows immediately."""
    if variant == "urgent_demo":
        tests = [
            {
                "test_name": "Hemoglobin",
                "result": "6.6",
                "unit": "g/dL",
                "normal_range": "12.0 - 15.5",
                "status": "Low",
                "explanation_en": "Hemoglobin is the protein in red blood cells that carries oxygen throughout your body. This level is well below the typical reference range.",
                "explanation_hi": "हीमोग्लोबिन लाल रक्त कोशिकाओं में मौजूद प्रोटीन है जो शरीर में ऑक्सीजन पहुँचाता है। यह स्तर सामान्य सीमा से काफी कम है।",
            },
            {
                "test_name": "Fasting Blood Glucose",
                "result": "118",
                "unit": "mg/dL",
                "normal_range": "70 - 99",
                "status": "High",
                "explanation_en": "Fasting glucose reflects blood sugar after not eating overnight. Your reading is mildly above the standard fasting range.",
                "explanation_hi": "फास्टिंग ग्लूकोज़ खाली पेट ब्लड शुगर का स्तर दिखाता है। यह मान सामान्य सीमा से थोड़ा अधिक है।",
            },
            {
                "test_name": "Platelet Count",
                "result": "210",
                "unit": "x10^3/uL",
                "normal_range": "150 - 450",
                "status": "Normal",
                "explanation_en": "Platelets help your blood clot properly. Your count is comfortably within the normal range.",
                "explanation_hi": "प्लेटलेट्स रक्त का थक्का जमाने में मदद करते हैं। आपकी संख्या सामान्य सीमा के भीतर है।",
            },
        ]
        raw = {
            "report_title": "Complete Blood Count & Fasting Sugar (Sample Urgent Alert Demo)",
            "report_date": "2026-11-15",
            "lab_name": "MedAi Demo Diagnostics",
            "tests": tests,
            "summary_en": (
                "This sample report shows a normal platelet count, a mildly elevated fasting glucose, "
                "and a significantly low hemoglobin value (6.6 g/dL) that triggers a validated clinical alert. "
                "Please share this result promptly with a qualified doctor for proper evaluation."
            ),
            "summary_hi": (
                "इस नमूना रिपोर्ट में प्लेटलेट काउंट सामान्य है, खाली पेट शुगर थोड़ी बढ़ी हुई है, और हीमोग्लोबिन "
                "(6.6 g/dL) काफी कम है जिसके लिए महत्वपूर्ण स्वास्थ्य अलर्ट जारी किया गया है। "
                "कृपया उचित मूल्यांकन के लिए तुरंत योग्य डॉक्टर से संपर्क करें।"
            ),
            "normal_highlights_en": ["Platelet Count (210 x10^3/uL) is within the healthy reference range."],
            "normal_highlights_hi": ["प्लेटलेट काउंट (210 x10^3/uL) सामान्य सीमा के भीतर है।"],
            "attention_points_en": [
                "Hemoglobin (6.6 g/dL) is markedly below the 12.0 - 15.5 g/dL reference range and warrants prompt medical review.",
                "Fasting Blood Glucose (118 mg/dL) is mildly elevated above 70 - 99 mg/dL.",
            ],
            "attention_points_hi": [
                "हीमोग्लोबिन (6.6 g/dL) सामान्य सीमा (12.0 - 15.5 g/dL) से काफी कम है और डॉक्टर से शीघ्र समीक्षा आवश्यक है।",
                "फास्टिंग ब्लड ग्लूकोज़ (118 mg/dL) सामान्य सीमा (70 - 99 mg/dL) से थोड़ा अधिक है।",
            ],
            "doctor_discussion_points_en": [
                "What could be causing my low hemoglobin, and do I need prompt follow-up tests such as iron studies or vitamin B12?",
                "Should I repeat the fasting blood glucose or check HbA1c?",
                "What symptoms mean I should seek immediate care?",
            ],
            "doctor_discussion_points_hi": [
                "मेरे कम हीमोग्लोबिन का क्या कारण हो सकता है, और क्या मुझे आयरन या विटामिन B12 की जांच करानी चाहिए?",
                "क्या मुझे फास्टिंग शुगर दोबारा जांचनी चाहिए या HbA1c टेस्ट कराना चाहिए?",
                "किन लक्षणों के दिखने पर मुझे तुरंत अस्पताल जाना चाहिए?",
            ],
            "simplified_terms": [
                {
                    "term": "Hemoglobin (Hb)",
                    "simple_en": "An iron-rich protein in red blood cells that carries oxygen from your lungs to the rest of your body.",
                    "simple_hi": "लाल रक्त कोशिकाओं में आयरन-युक्त प्रोटीन जो फेफड़ों से पूरे शरीर में ऑक्सीजन पहुँचाता है।",
                },
                {
                    "term": "Fasting Blood Glucose",
                    "simple_en": "The level of sugar in your blood measured after not eating or drinking calories for 8–12 hours.",
                    "simple_hi": "8–12 घंटे खाली पेट रहने के बाद रक्त में मापी गई शुगर की मात्रा।",
                },
            ],
        }
    else:
        tests = [
            {
                "test_name": "Hemoglobin",
                "result": "11.2",
                "unit": "g/dL",
                "normal_range": "12.0 - 15.5",
                "status": "Low",
                "explanation_en": "Hemoglobin carries oxygen in your red blood cells. Your value is slightly below the reference range, which can sometimes relate to mild anemia or low iron.",
                "explanation_hi": "हीमोग्लोबिन लाल रक्त कोशिकाओं में ऑक्सीजन ले जाता है। आपका मान सामान्य सीमा से थोड़ा कम है, जो हल्के एनीमिया या आयरन की कमी से जुड़ा हो सकता है।",
            },
            {
                "test_name": "Fasting Blood Glucose",
                "result": "114",
                "unit": "mg/dL",
                "normal_range": "70 - 99",
                "status": "High",
                "explanation_en": "Fasting glucose shows your blood sugar after an overnight fast. A reading of 114 mg/dL is mildly elevated and worth reviewing with your doctor.",
                "explanation_hi": "फास्टिंग ग्लूकोज़ खाली पेट ब्लड शुगर दिखाता है। 114 mg/dL का मान सामान्य से थोड़ा अधिक है और डॉक्टर से चर्चा करने योग्य है।",
            },
            {
                "test_name": "HbA1c",
                "result": "6.0",
                "unit": "%",
                "normal_range": "4.0 - 5.6",
                "status": "High",
                "explanation_en": "HbA1c estimates your average blood sugar over the past 2–3 months. Your result is slightly above the typical range.",
                "explanation_hi": "HbA1c पिछले 2–3 महीनों के औसत ब्लड शुगर का अनुमान देता है। यह परिणाम सामान्य सीमा से थोड़ा ऊपर है।",
            },
            {
                "test_name": "Total Cholesterol",
                "result": "182",
                "unit": "mg/dL",
                "normal_range": "< 200",
                "status": "Normal",
                "explanation_en": "Total cholesterol measures the overall fats circulating in your blood. Your result is within the desirable range.",
                "explanation_hi": "कुल कोलेस्ट्रॉल रक्त में मौजूद वसा की मात्रा मापता है। आपका मान वांछित सामान्य सीमा के भीतर है।",
            },
            {
                "test_name": "Serum Creatinine",
                "result": "0.85",
                "unit": "mg/dL",
                "normal_range": "0.6 - 1.2",
                "status": "Normal",
                "explanation_en": "Creatinine is a waste product filtered by the kidneys. A normal value is a reassuring sign of healthy kidney filtration.",
                "explanation_hi": "क्रिएटिनिन एक अपशिष्ट पदार्थ है जिसे किडनी छानती है। सामान्य मान किडनी के स्वस्थ कामकाज का अच्छा संकेत है।",
            },
            {
                "test_name": "TSH (Thyroid Stimulating Hormone)",
                "result": "2.4",
                "unit": "mIU/L",
                "normal_range": "0.4 - 4.5",
                "status": "Normal",
                "explanation_en": "TSH checks how actively your thyroid gland is working. Your level sits comfortably in the normal range.",
                "explanation_hi": "TSH जांचता है कि आपकी थायरॉइड ग्रंथि कितनी अच्छी तरह काम कर रही है। आपका स्तर सामान्य सीमा में है।",
            },
            {
                "test_name": "Vitamin D (25-OH)",
                "result": "18",
                "unit": "ng/mL",
                "normal_range": "30 - 100",
                "status": "Low",
                "explanation_en": "Vitamin D supports bone strength, immunity, and energy. Your level is lower than the recommended range.",
                "explanation_hi": "विटामिन D हड्डियों की मजबूती, रोग प्रतिरोधक क्षमता और ऊर्जा के लिए महत्वपूर्ण है। आपका स्तर सामान्य सीमा से कम है।",
            },
        ]
        raw = {
            "report_title": f"Comprehensive Health Panel ({file_name})",
            "report_date": "2026-11-12",
            "lab_name": "MedAi Demo Diagnostics",
            "tests": tests,
            "summary_en": (
                "Most of your core organ markers—including Total Cholesterol, Kidney Creatinine, and Thyroid (TSH)—are "
                "comfortably within the normal range. A few values need routine attention at your next doctor visit: "
                "Hemoglobin and Vitamin D are mildly low, while Fasting Glucose and HbA1c are mildly elevated. "
                "None of the values fall into an urgent range."
            ),
            "summary_hi": (
                "आपके अधिकांश प्रमुख अंगों की जांच—जैसे कुल कोलेस्ट्रॉल, किडनी क्रिएटिनिन और थायरॉइड (TSH)—सामान्य सीमा में हैं। "
                "कुछ मानों पर अगली डॉक्टर मुलाकात में सामान्य ध्यान देने की आवश्यकता है: हीमोग्लोबिन और विटामिन D थोड़ा कम हैं, "
                "जबकि खाली पेट शुगर और HbA1c हल्के बढ़े हुए हैं। कोई भी मान तुरंत खतरे (urgent) की श्रेणी में नहीं है।"
            ),
            "normal_highlights_en": [
                "Total Cholesterol (182 mg/dL) is well within the healthy < 200 mg/dL target.",
                "Serum Creatinine (0.85 mg/dL) indicates normal kidney filtration.",
                "Thyroid TSH (2.4 mIU/L) is comfortably in the normal range.",
            ],
            "normal_highlights_hi": [
                "कुल कोलेस्ट्रॉल (182 mg/dL) स्वस्थ सीमा (< 200 mg/dL) के भीतर है।",
                "सीरम क्रिएटिनिन (0.85 mg/dL) सामान्य किडनी कार्यप्रणाली दर्शाता है।",
                "थायरॉइड TSH (2.4 mIU/L) पूरी तरह सामान्य सीमा में है।",
            ],
            "attention_points_en": [
                "Hemoglobin (11.2 g/dL) is mildly below the 12.0 - 15.5 g/dL reference range.",
                "Fasting Glucose (114 mg/dL) and HbA1c (6.0%) are mildly above standard ranges.",
                "Vitamin D (18 ng/mL) is below the 30 - 100 ng/mL reference range.",
            ],
            "attention_points_hi": [
                "हीमोग्लोबिन (11.2 g/dL) सामान्य सीमा (12.0 - 15.5 g/dL) से थोड़ा कम है।",
                "फास्टिंग ग्लूकोज़ (114 mg/dL) और HbA1c (6.0%) सामान्य सीमा से थोड़े अधिक हैं।",
                "विटामिन D (18 ng/mL) सामान्य सीमा (30 - 100 ng/mL) से कम है।",
            ],
            "doctor_discussion_points_en": [
                "Would you recommend checking iron/ferritin or B12 to understand my slightly low hemoglobin?",
                "What lifestyle habits or follow-up timeline do you advise for my HbA1c of 6.0% and fasting glucose of 114 mg/dL?",
                "Do I need a Vitamin D supplement, and when should I retest?",
                "How often should I repeat this full health panel?",
            ],
            "doctor_discussion_points_hi": [
                "थोड़े कम हीमोग्लोबिन का कारण जानने के लिए क्या आयरन/फेरिटिन या B12 जांच करानी चाहिए?",
                "HbA1c (6.0%) और फास्टिंग शुगर (114 mg/dL) के लिए आप कौन सी जीवनशैली या फॉलो-अप की सलाह देंगे?",
                "क्या मुझे विटामिन D सप्लीमेंट लेना चाहिए, और दोबारा जांच कब करानी चाहिए?",
                "यह पूरा हेल्थ पैनल कितनी अवधि बाद दोहराना चाहिए?",
            ],
            "simplified_terms": [
                {
                    "term": "HbA1c (Glycated Hemoglobin)",
                    "simple_en": "A blood test showing your average blood sugar level over the last 2 to 3 months, rather than just a single moment.",
                    "simple_hi": "एक रक्त परीक्षण जो केवल एक दिन के बजाय पिछले 2 से 3 महीनों के औसत ब्लड शुगर को दर्शाता है।",
                },
                {
                    "term": "Serum Creatinine",
                    "simple_en": "A natural waste product from muscles that healthy kidneys filter out into urine; used to check kidney health.",
                    "simple_hi": "मांसपेशियों से बनने वाला प्राकृतिक अपशिष्ट जिसे स्वस्थ किडनी बाहर निकालती है; इसका उपयोग किडनी की सेहत जांचने के लिए होता है।",
                },
                {
                    "term": "TSH (Thyroid Stimulating Hormone)",
                    "simple_en": "A signal hormone from the brain that regulates your thyroid gland, which controls metabolism and energy.",
                    "simple_hi": "मस्तिष्क से निकलने वाला हार्मोन जो थायरॉइड ग्रंथि को नियंत्रित करता है, जिससे शरीर की ऊर्जा और मेटाबॉलिज़्म चलता है।",
                },
            ],
        }

    # Apply deterministic clinical rules engine (Module 13)
    rule_eval = evaluate_clinical_alerts(raw["tests"])
    raw["tests"] = rule_eval["tests"]
    raw["alerts"] = rule_eval["alerts"]
    raw["urgent_count"] = rule_eval["urgent_count"]
    raw["attention_count"] = rule_eval["attention_count"]
    raw["disclaimer_en"] = Config.MEDICAL_DISCLAIMER_EN
    raw["disclaimer_hi"] = Config.MEDICAL_DISCLAIMER_HI
    raw["ai_mode"] = "demo"
    return raw


def analyze_medical_report(
    file_bytes: bytes,
    mime_type: str,
    file_name: str,
    demo_variant: str = "standard",
) -> Dict[str, Any]:
    """
    Extracts and simplifies a medical report (PDF, PNG, JPG) using Gemini 3.8 Flash
    via the Interactions API, then validates every extracted row against deterministic
    clinical alert rules (Module 13).
    """
    if not is_gemini_configured():
        return _build_demo_report_analysis(file_name, variant=demo_variant)

    b64_data = base64.b64encode(file_bytes).decode("utf-8")
    media_block: Dict[str, Any]
    if mime_type == "application/pdf":
        media_block = {
            "type": "document",
            "data": b64_data,
            "mime_type": "application/pdf",
        }
    else:
        media_block = {
            "type": "image",
            "data": b64_data,
            "mime_type": mime_type,
        }

    prompt = (
        f"Analyze the attached medical laboratory report (filename: {file_name}). "
        "Extract every visible test name, measured result, unit, and printed reference range. "
        "Provide clear, empathetic explanations in BOTH English and Hindi (Devanagari), "
        "normal highlights, points needing attention, questions to discuss with a doctor, "
        "and simplified explanations of complex medical terms found in the report."
    )

    interaction = create_interaction_with_fallback(
        model=Config.GEMINI_MODEL,
        system_instruction=REPORT_ANALYSIS_SYSTEM_INSTRUCTION,
        input=[
            {"type": "text", "text": prompt},
            media_block,
        ],
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": ReportAnalysisSchema.model_json_schema(),
        },
    )

    parsed = ReportAnalysisSchema.model_validate_json(interaction.output_text)
    data = parsed.model_dump()

    # Run deterministic validated clinical rules (Module 13)
    rule_eval = evaluate_clinical_alerts(data["tests"])
    data["tests"] = rule_eval["tests"]
    data["alerts"] = rule_eval["alerts"]
    data["urgent_count"] = rule_eval["urgent_count"]
    data["attention_count"] = rule_eval["attention_count"]
    data["disclaimer_en"] = Config.MEDICAL_DISCLAIMER_EN
    data["disclaimer_hi"] = Config.MEDICAL_DISCLAIMER_HI
    data["ai_mode"] = "live-gemini"
    return data


def _format_report_context(report: Optional[Dict[str, Any]]) -> str:
    if not report:
        return ""
    analysis = report.get("analysis") or {}
    tests = analysis.get("tests") or []
    lines = [
        f"ATTACHED PATIENT REPORT CONTEXT (Title: {report.get('title')}, Date: {report.get('report_date') or 'N/A'}):"
    ]
    for t in tests:
        lines.append(
            f"- {t.get('test_name')}: {t.get('result')} {t.get('unit', '')} "
            f"(Normal range: {t.get('normal_range', 'N/A')}, Status: {t.get('status', 'Unknown')}, "
            f"Alert: {t.get('alert_severity', 'normal')})"
        )
    if analysis.get("summary_en"):
        lines.append(f"Report summary: {analysis['summary_en']}")
    return "\n".join(lines)


def _build_demo_chat_reply(
    message: str,
    language: str,
    report: Optional[Dict[str, Any]],
) -> str:
    msg_low = message.lower()
    is_hi = language == "hi"
    is_hinglish = language == "hinglish"

    # Check if user asks about a specific test in attached report
    if report:
        tests = (report.get("analysis") or {}).get("tests") or []
        for t in tests:
            name = (t.get("test_name") or "").lower()
            if name and (name in msg_low or any(w in msg_low for w in name.split() if len(w) > 3)):
                if is_hi:
                    return (
                        f"आपकी संलग्न रिपोर्ट ({report.get('title')}) के अनुसार, आपका **{t.get('test_name')}** मान "
                        f"**{t.get('result')} {t.get('unit', '')}** है (सामान्य सीमा: {t.get('normal_range', 'उपलब्ध नहीं')}, "
                        f"स्थिति: {t.get('status')})।\n\n"
                        f"{t.get('explanation_hi') or t.get('explanation_en')}\n\n"
                        "मैं आपको सलाह दूँगा कि अगले परामर्श में अपने डॉक्टर से पूछें कि क्या इसके लिए किसी अतिरिक्त जांच या जीवनशैली बदलाव की आवश्यकता है। "
                        "*(डेमो मोड: लाइव AI उत्तरों के लिए `backend/.env` में `GEMINI_API_KEY` जोड़ें।)*"
                    )
                if is_hinglish:
                    return (
                        f"Aapki attached report (**{report.get('title')}**) ke hisaab se, aapka **{t.get('test_name')}** "
                        f"**{t.get('result')} {t.get('unit', '')}** hai (Normal range: {t.get('normal_range', 'N/A')}, "
                        f"Status: **{t.get('status')}**).\n\n"
                        f"{t.get('explanation_en')}\n\n"
                        "Apni next doctor visit mein zaroor poochein ki kya is value ke liye koi follow-up test ya lifestyle change zaroori hai. "
                        "*(Demo Mode — live Gemini 3.8 Flash ke liye `backend/.env` mein `GEMINI_API_KEY` set karein.)*"
                    )
                return (
                    f"Based on your attached report (**{report.get('title')}**), your **{t.get('test_name')}** result is "
                    f"**{t.get('result')} {t.get('unit', '')}** (Reference range: {t.get('normal_range', 'N/A')}, "
                    f"Status: **{t.get('status')}**).\n\n"
                    f"{t.get('explanation_en')}\n\n"
                    "A helpful question for your next doctor visit is whether any follow-up test or lifestyle adjustment is recommended for this value. "
                    "*(Demo Mode — add `GEMINI_API_KEY` in `backend/.env` for live Gemini 3.8 Flash responses.)*"
                )

        if any(k in msg_low for k in ["report", "summary", "explain", "attention", "samjha", "batao", "रिपोर्ट", "सारांश", "समझा"]):
            analysis = report.get("analysis") or {}
            if is_hi:
                pts = "\n".join(f"• {p}" for p in analysis.get("attention_points_hi", []))
                return (
                    f"**{report.get('title')}** का सरल सारांश:\n\n"
                    f"{analysis.get('summary_hi', '')}\n\n"
                    f"**ध्यान देने योग्य बिंदु:**\n{pts or '• कोई असामान्य बिंदु नहीं मिला।'}\n\n"
                    "कृपया किसी भी दवाई में बदलाव से पहले हमेशा अपने डॉक्टर से सलाह लें। *(डेमो मोड)*"
                )
            if is_hinglish:
                pts = "\n".join(f"• {p}" for p in analysis.get("attention_points_en", []))
                return (
                    f"**{report.get('title')}** ka simple overview:\n\n"
                    f"{analysis.get('summary_en', '')}\n\n"
                    f"**Jin values par dhyan dena hai:**\n{pts or '• Sab values normal range mein hain.'}\n\n"
                    "Koi bhi dawai ya treatment change karne se pehle hamesha apne doctor se consult karein. *(Demo Mode)*"
                )
            pts = "\n".join(f"• {p}" for p in analysis.get("attention_points_en", []))
            return (
                f"Here is a simple overview of **{report.get('title')}**:\n\n"
                f"{analysis.get('summary_en', '')}\n\n"
                f"**Values needing attention:**\n{pts or '• All extracted values are within range.'}\n\n"
                "Please review these points with your doctor before making any health or medication changes. *(Demo Mode)*"
            )

    if is_hi:
        return (
            "नमस्ते! मैं **डॉ. सेहत** हूँ — आपका मेडिकल जानकारी सहायक। "
            "मैं आपकी लैब रिपोर्ट के मानों, मेडिकल शब्दों और डॉक्टर से पूछे जाने वाले प्रश्नों को आसान भाषा में समझने में आपकी मदद कर सकता हूँ।\n\n"
            "आप ऊपर अपनी कोई अपलोड की गई रिपोर्ट चुन सकते हैं और किसी भी टेस्ट (जैसे *हीमोग्लोबिन*, *ग्लूकोज़*, *HbA1c* या *विटामिन D*) के बारे में पूछ सकते हैं।\n\n"
            "*(नोट: मैं बीमारी का निदान नहीं करता या दवाई नहीं लिखता। लाइव Gemini 3.8 Flash चैट के लिए `backend/.env` में `GEMINI_API_KEY` जोड़ें।)*"
        )

    if is_hinglish:
        return (
            "Namaste! Main **Dr. Sehat** hoon — aapka MedAi medical information assistant. "
            "Main aapki lab reports, medical terms aur doctor visit ke questions ko bilkul simple Hinglish mein samjhane mein help kar sakta hoon.\n\n"
            "Aap upar apni koi uploaded report select karein aur kisi bhi test (jaise *Hemoglobin*, *Glucose*, *HbA1c* ya *Vitamin D*) ke baare mein pooch sakte hain!\n\n"
            "*(Note: Main sirf educational info deta hoon — diagnosis ya prescription nahi karta.)*"
        )

    return (
        "Hello! I'm **Dr. Sehat**, your MedAi medical communication assistant. "
        "I can help explain lab test terms, walk through your uploaded medical reports in plain language, "
        "and help you prepare thoughtful questions for your doctor.\n\n"
        "Tip: Select one of your uploaded reports above and ask me about any specific test (for example, "
        "*\"Explain my Hemoglobin\"* or *\"What should I ask my doctor about this report?\"*).\n\n"
        "*(Note: I provide educational explanations only—not diagnoses or prescriptions. "
        "Add `GEMINI_API_KEY` in `backend/.env` to enable live Gemini 3.8 Flash conversations.)*"
    )


def chat_with_dr_sehat(
    message: str,
    language: str = "en",
    report: Optional[Dict[str, Any]] = None,
    previous_interaction_id: Optional[str] = None,
    recent_history: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Sends a message to Dr. Sehat using Gemini 3.8 Flash Interactions API.
    Uses stateful `previous_interaction_id` when available and re-specifies
    `system_instruction` on every turn per Interactions API best practices.
    """
    if language == "hi":
        lang_label = "Hindi (natural Devanagari script)"
    elif language == "hinglish":
        lang_label = "Hinglish (warm, natural conversational Hindi written in English/Roman script, keeping standard medical terms clear)"
    else:
        lang_label = "English"

    if not is_gemini_configured():
        return {
            "reply": _build_demo_chat_reply(message, language, report),
            "interaction_id": None,
            "ai_mode": "demo",
        }

    report_context = _format_report_context(report)
    turn_system_instruction = (
        f"{DR_SEHAT_SYSTEM_INSTRUCTION}\n\n"
        f"Preferred response language: {lang_label}."
    )
    if report_context:
        turn_system_instruction += f"\n\n{report_context}"

    kwargs: Dict[str, Any] = {
        "model": Config.GEMINI_MODEL,
        "system_instruction": turn_system_instruction,
        "input": message,
    }
    if previous_interaction_id:
        kwargs["previous_interaction_id"] = previous_interaction_id
    elif recent_history:
        transcript_lines = []
        for h in recent_history[-8:]:
            speaker = "Patient" if h.get("role") == "user" else "Dr. Sehat"
            transcript_lines.append(f"{speaker}: {h.get('content', '')}")
        transcript_lines.append(f"Patient: {message}")
        kwargs["input"] = "\n".join(transcript_lines)

    interaction = create_interaction_with_fallback(**kwargs)
    return {
        "reply": interaction.output_text or "",
        "interaction_id": getattr(interaction, "id", None),
        "ai_mode": "live-gemini",
    }

