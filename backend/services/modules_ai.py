"""
MedAi Modules 5, 9, 10, 11, and 12 — AI + Deterministic Clinical Communication Services.

Uses Gemini 3.8 Flash via the modern google-genai Interactions API with Pydantic structured outputs,
plus realistic Demo Mode fallbacks when GEMINI_API_KEY is not configured.
"""

from __future__ import annotations

import base64
import re
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from config import Config
from services.clinical_rules import _extract_number, _parse_range, evaluate_clinical_alerts
from services.gemini_service import (
    _format_report_context,
    create_interaction_with_fallback,
    is_gemini_configured,
)


# Mandatory exact disclaimer from the MedAi Implementation Plan (Module 10)
LIFESTYLE_MANDATORY_DISCLAIMER_EN = (
    "The diet, exercise and lifestyle recommendations provided by this application are intended to "
    "support your general health and well-being. These recommendations do NOT mean that you should "
    "stop taking, reduce, skip or replace any medicine prescribed by your doctor. Continue taking "
    "your prescribed medicines as directed by your healthcare professional. Do not change your "
    "medication or treatment without consulting your doctor. Lifestyle changes are supportive "
    "measures and are not a substitute for medical treatment."
)

LIFESTYLE_MANDATORY_DISCLAIMER_HI = (
    "इस एप्लिकेशन द्वारा दिए गए आहार, व्यायाम और जीवनशैली के सुझाव केवल आपके सामान्य स्वास्थ्य और कल्याण "
    "के सहयोग के लिए हैं। इन सुझावों का यह अर्थ बिल्कुल नहीं है कि आप अपने डॉक्टर द्वारा लिखी गई किसी भी दवाई "
    "को बंद करें, कम करें, छोड़ें या बदलें। कृपया अपने डॉक्टर के निर्देशानुसार निर्धारित दवाइयाँ नियमित रूप से लेते रहें। "
    "डॉक्टर से परामर्श किए बिना अपनी दवाई या उपचार में कोई बदलाव न करें। जीवनशैली में बदलाव सहायक उपाय हैं और "
    "चिकित्सा उपचार का विकल्प नहीं हैं।"
)


# =============================================================================
# MODULE 5: PRESCRIPTION EXPLAINER
# =============================================================================


class PrescriptionMedicineItem(BaseModel):
    medicine_name: str = Field(
        description="Legible medicine name as written, or 'Unclear — confirm with doctor/pharmacist' if illegible."
    )
    dosage_and_form: str = Field(default="", description="Strength/form if clearly written (e.g., 500 mg Tablet), else 'Unclear / Not specified'.")
    frequency_raw: str = Field(default="", description="Abbreviation or schedule as written (e.g., 1-0-1, BD, OD, HS).")
    instructions_en: str = Field(description="Plain-English explanation of written schedule/timing, or explicit confirmation prompt if uncertain.")
    instructions_hi: str = Field(description="Plain-Hindi explanation of written schedule/timing, or explicit confirmation prompt if uncertain.")
    purpose_note_en: str = Field(description="General educational note on what this class of medicine is commonly used for (never diagnosing), or 'Confirm with pharmacist' if uncertain.")
    purpose_note_hi: str = Field(description="General educational note in Hindi (never diagnosing), or confirmation prompt if uncertain.")
    legibility_status: str = Field(description="Strictly one of: clear, uncertain, unreadable.")
    uncertainty_reason_en: str = Field(default="", description="If uncertain/unreadable, explain what part of handwriting or instruction is unclear.")
    uncertainty_reason_hi: str = Field(default="", description="Same uncertainty note in Hindi.")


class AbbreviationItem(BaseModel):
    code: str = Field(description="Medical abbreviation found (e.g., BD, OD, PC, HS, SOS, TDS).")
    meaning_en: str = Field(description="Plain-English meaning.")
    meaning_hi: str = Field(description="Plain-Hindi meaning.")


class PrescriptionSchema(BaseModel):
    title: str = Field(description="Short title such as 'Outpatient Prescription (Dr. Sharma)'.")
    doctor_or_clinic: str = Field(default="", description="Doctor/clinic name if legible, else empty.")
    prescription_date: str = Field(default="", description="Date if legible, else empty.")
    medicines: List[PrescriptionMedicineItem]
    abbreviations_explained: List[AbbreviationItem]
    general_instructions_en: List[str] = Field(description="Other clearly written instructions (e.g., follow-up date, lab tests advised).")
    general_instructions_hi: List[str]
    safety_reminders_en: List[str]
    safety_reminders_hi: List[str]


PRESCRIPTION_SYSTEM_INSTRUCTION = """You are MedAi's Prescription Explainer.
Your job is to help patients read and organize clearly legible text on a prescription and explain medical abbreviations in plain English and Hindi.

STRICT SAFETY RULES:
1. NEVER guess an unclear handwritten medicine name, strength, or dosage.
2. If handwriting is smeared, ambiguous, cropped, or partially illegible, set legibility_status to "uncertain" or "unreadable", state clearly what is uncertain, and instruct the patient to confirm with their prescribing doctor or licensed pharmacist.
3. Explain standard prescription abbreviations (e.g., OD, BD, TDS, HS, SOS, AC, PC, 1-0-1) clearly in English and Hindi.
4. NEVER advise stopping, starting, substituting, or changing any dosage.
"""


def build_demo_prescription(file_name: str = "sample_prescription.jpg") -> Dict[str, Any]:
    medicines = [
        {
            "medicine_name": "Tab. Metformin 500 mg (SR)",
            "dosage_and_form": "500 mg Sustained-Release Tablet",
            "frequency_raw": "1-0-1 PC (BD)",
            "instructions_en": "Written as 1 tablet in the morning and 1 tablet at night, after meals (PC = Post Cibum / after food).",
            "instructions_hi": "सुबह 1 गोली और रात में 1 गोली, भोजन के बाद (PC = भोजन के बाद) लेने का निर्देश लिखा है।",
            "purpose_note_en": "Commonly prescribed to help support healthy blood sugar management. Follow your doctor's exact schedule.",
            "purpose_note_hi": "आमतौर पर ब्लड शुगर को नियंत्रित रखने में मदद के लिए लिखी जाती है। कृपया डॉक्टर के बताए समय का पालन करें।",
            "legibility_status": "clear",
            "uncertainty_reason_en": "",
            "uncertainty_reason_hi": "",
        },
        {
            "medicine_name": "Cap. Vitamin D3 (Cholecalciferol) 60,000 IU",
            "dosage_and_form": "60,000 IU Capsule",
            "frequency_raw": "1 Cap Weekly x 8 weeks",
            "instructions_en": "Written as 1 capsule once a week for 8 weeks (often taken after a meal with milk or water).",
            "instructions_hi": "8 सप्ताह तक सप्ताह में एक बार 1 कैप्सूल लेने का निर्देश लिखा है।",
            "purpose_note_en": "A Vitamin D supplement commonly prescribed when blood Vitamin D levels are low.",
            "purpose_note_hi": "यह विटामिन D सप्लीमेंट है, जो आमतौर पर विटामिन D का स्तर कम होने पर लिखा जाता है।",
            "legibility_status": "clear",
            "uncertainty_reason_en": "",
            "uncertainty_reason_hi": "",
        },
        {
            "medicine_name": "Uncertain Handwritten Entry (looks like 'Tab. A... 10 mg')",
            "dosage_and_form": "Unclear strength/spelling",
            "frequency_raw": "HS (unclear duration)",
            "instructions_en": "Do NOT guess this medicine. The handwritten name and number of days are unclear — please verify directly with your doctor or pharmacist before taking.",
            "instructions_hi": "इस दवाई का अनुमान न लगाएं। लिखावट में दवाई का नाम और अवधि स्पष्ट नहीं है — कृपया इसे लेने से पहले अपने डॉक्टर या फार्मासिस्ट से पुष्टि करें।",
            "purpose_note_en": "Cannot confirm safely due to unclear handwriting. Ask your pharmacist to read the original prescription.",
            "purpose_note_hi": "अस्पष्ट लिखावट के कारण सुरक्षित पुष्टि संभव नहीं है। कृपया फार्मासिस्ट या डॉक्टर को मूल पर्चा दिखाएं।",
            "legibility_status": "uncertain",
            "uncertainty_reason_en": "The middle letters of the medicine name and duration in days are smudged/illegible.",
            "uncertainty_reason_hi": "दवाई के नाम के बीच के अक्षर और दिनों की संख्या स्पष्ट रूप से पढ़ी नहीं जा सकी।",
        },
    ]
    abbreviations = [
        {"code": "BD / 1-0-1", "meaning_en": "Twice daily (typically morning and night).", "meaning_hi": "दिन में दो बार (आमतौर पर सुबह और रात)।"},
        {"code": "PC", "meaning_en": "Post Cibum — take after meals.", "meaning_hi": "भोजन के बाद लें।"},
        {"code": "HS", "meaning_en": "Hora Somni — take at bedtime.", "meaning_hi": "रात को सोने से पहले लें।"},
        {"code": "SR", "meaning_en": "Sustained Release — releases medicine slowly; usually swallowed whole unless doctor advises otherwise.", "meaning_hi": "धीरे-धीरे असर करने वाली गोली (आमतौर पर बिना तोड़े निगली जाती है)।"},
    ]
    uncertain_count = sum(1 for m in medicines if m["legibility_status"] != "clear")
    return {
        "title": f"Sample Outpatient Prescription ({file_name})",
        "doctor_or_clinic": "MedAi Demo Clinic",
        "prescription_date": "2026-11-14",
        "medicines": medicines,
        "abbreviations_explained": abbreviations,
        "general_instructions_en": [
            "Review blood sugar log and repeat Fasting Glucose / HbA1c before follow-up.",
            "Follow up in 4 weeks with latest lab reports.",
        ],
        "general_instructions_hi": [
            "अगली मुलाकात से पहले ब्लड शुगर और HbA1c जांच की सलाह।",
            "4 सप्ताह बाद नई लैब रिपोर्ट के साथ फॉलो-अप करें।",
        ],
        "safety_reminders_en": [
            "Always confirm any highlighted or uncertain entries directly with your prescribing doctor or licensed pharmacist.",
            "Do not alter, skip, or stop prescribed medicines based on an AI explanation.",
        ],
        "safety_reminders_hi": [
            "किसी भी अस्पष्ट या हाइलाइट की गई दवाई की पुष्टि हमेशा अपने डॉक्टर या फार्मासिस्ट से करें।",
            "AI व्याख्या के आधार पर अपनी दवाइयों में कोई बदलाव न करें।",
        ],
        "uncertain_count": uncertain_count,
        "disclaimer_en": Config.MEDICAL_DISCLAIMER_EN,
        "disclaimer_hi": Config.MEDICAL_DISCLAIMER_HI,
        "ai_mode": "demo",
    }


def analyze_prescription(file_bytes: bytes, mime_type: str, file_name: str) -> Dict[str, Any]:
    if not is_gemini_configured():
        return build_demo_prescription(file_name)

    b64_data = base64.b64encode(file_bytes).decode("utf-8")
    media_block = (
        {"type": "document", "data": b64_data, "mime_type": "application/pdf"}
        if mime_type == "application/pdf"
        else {"type": "image", "data": b64_data, "mime_type": mime_type}
    )

    prompt = (
        f"Carefully inspect the uploaded medical prescription ({file_name}). "
        "Extract ONLY clearly legible medicine names, dosages, timings, and general instructions. "
        "Decode every medical abbreviation found in both English and Hindi. "
        "For ANY unclear or smudged handwriting, mark legibility_status as 'uncertain' or 'unreadable' "
        "and instruct the patient to confirm with their doctor or pharmacist rather than guessing."
    )

    interaction = create_interaction_with_fallback(
        model=Config.GEMINI_MODEL,
        system_instruction=PRESCRIPTION_SYSTEM_INSTRUCTION,
        input=[{"type": "text", "text": prompt}, media_block],
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": PrescriptionSchema.model_json_schema(),
        },
    )
    data = PrescriptionSchema.model_validate_json(interaction.output_text).model_dump()
    data["uncertain_count"] = sum(
        1 for m in data.get("medicines", []) if m.get("legibility_status", "clear") != "clear"
    )
    data["disclaimer_en"] = Config.MEDICAL_DISCLAIMER_EN
    data["disclaimer_hi"] = Config.MEDICAL_DISCLAIMER_HI
    data["ai_mode"] = "live-gemini"
    return data


# =============================================================================
# MODULE 9: MEDICAL REPORT COMPARISON & HEALTH PROGRESS
# =============================================================================


def _canonical_test_key(name: str) -> str:
    n = re.sub(r"\(.*?\)", "", (name or "").lower()).strip()
    n = re.sub(r"[^a-z0-9]+", " ", n).strip()
    synonyms = {
        "hb": "hemoglobin",
        "hgb": "hemoglobin",
        "haemoglobin": "hemoglobin",
        "fbs": "fasting blood glucose",
        "fasting glucose": "fasting blood glucose",
        "fasting blood sugar": "fasting blood glucose",
        "a1c": "hba1c",
        "glycated hemoglobin": "hba1c",
        "s creatinine": "serum creatinine",
        "creatinine": "serum creatinine",
        "tsh": "tsh",
        "thyroid stimulating hormone": "tsh",
        "vitamin d": "vitamin d",
        "25 oh vitamin d": "vitamin d",
        "total cholesterol": "total cholesterol",
        "cholesterol total": "total cholesterol",
        "platelet count": "platelets",
        "platelet": "platelets",
    }
    return synonyms.get(n, n)


def _normalize_unit(unit: str) -> str:
    return re.sub(r"\s+", "", (unit or "").lower()).replace("gm/", "g/")


def _distance_outside_range(val: float, low: Optional[float], high: Optional[float]) -> float:
    if low is not None and val < low:
        return low - val
    if high is not None and val > high:
        return val - high
    return 0.0


def build_earlier_sample_report() -> Dict[str, Any]:
    """Builds an earlier baseline lab report so users can immediately test Report Comparison."""
    tests = [
        {
            "test_name": "Hemoglobin",
            "result": "10.4",
            "unit": "g/dL",
            "normal_range": "12.0 - 15.5",
            "status": "Low",
            "explanation_en": "Hemoglobin carries oxygen in your red blood cells. This baseline reading was below the normal reference range.",
            "explanation_hi": "हीमोग्लोबिन लाल रक्त कोशिकाओं में ऑक्सीजन ले जाता है। यह पिछला मान सामान्य सीमा से कम था।",
        },
        {
            "test_name": "Fasting Blood Glucose",
            "result": "106",
            "unit": "mg/dL",
            "normal_range": "70 - 99",
            "status": "High",
            "explanation_en": "Fasting blood glucose was mildly elevated above the 70 - 99 mg/dL range.",
            "explanation_hi": "खाली पेट ब्लड शुगर सामान्य सीमा (70 - 99 mg/dL) से थोड़ा अधिक था।",
        },
        {
            "test_name": "HbA1c",
            "result": "6.3",
            "unit": "%",
            "normal_range": "4.0 - 5.6",
            "status": "High",
            "explanation_en": "Average 3-month blood sugar was elevated above the normal range.",
            "explanation_hi": "पिछले 3 महीनों का औसत ब्लड शुगर सामान्य सीमा से अधिक था।",
        },
        {
            "test_name": "Total Cholesterol",
            "result": "188",
            "unit": "mg/dL",
            "normal_range": "< 200",
            "status": "Normal",
            "explanation_en": "Total cholesterol was within the desirable < 200 mg/dL limit.",
            "explanation_hi": "कुल कोलेस्ट्रॉल सामान्य सीमा (< 200 mg/dL) के भीतर था।",
        },
        {
            "test_name": "Serum Creatinine",
            "result": "0.84",
            "unit": "mg/dL",
            "normal_range": "0.6 - 1.2",
            "status": "Normal",
            "explanation_en": "Creatinine was well within the healthy kidney reference range.",
            "explanation_hi": "क्रिएटिनिन सामान्य स्वस्थ सीमा के भीतर था।",
        },
        {
            "test_name": "TSH (Thyroid Stimulating Hormone)",
            "result": "2.3",
            "unit": "mIU/L",
            "normal_range": "0.4 - 4.5",
            "status": "Normal",
            "explanation_en": "Thyroid function marker was normal.",
            "explanation_hi": "थायरॉइड जांच सामान्य थी।",
        },
        {
            "test_name": "Vitamin D (25-OH)",
            "result": "14",
            "unit": "ng/mL",
            "normal_range": "30 - 100",
            "status": "Low",
            "explanation_en": "Vitamin D level was significantly below the 30 - 100 ng/mL reference range.",
            "explanation_hi": "विटामिन D का स्तर सामान्य सीमा से काफी कम था।",
        },
    ]
    rule_eval = evaluate_clinical_alerts(tests)
    return {
        "report_title": "Baseline Health Panel (3 Months Earlier)",
        "report_date": "2026-08-10",
        "lab_name": "MedAi Demo Diagnostics",
        "tests": rule_eval["tests"],
        "alerts": rule_eval["alerts"],
        "urgent_count": rule_eval["urgent_count"],
        "attention_count": rule_eval["attention_count"],
        "summary_en": "Baseline report from 3 months earlier showing lower Hemoglobin and Vitamin D, and elevated HbA1c, with normal cholesterol, kidney, and thyroid markers.",
        "summary_hi": "3 महीने पहले की बेसलाइन रिपोर्ट जिसमें हीमोग्लोबिन और विटामिन D कम थे, HbA1c बढ़ा था, जबकि कोलेस्ट्रॉल, किडनी और थायरॉइड सामान्य थे।",
        "normal_highlights_en": ["Total Cholesterol, Creatinine, and TSH were normal."],
        "normal_highlights_hi": ["कोलेस्ट्रॉल, क्रिएटिनिन और TSH सामान्य थे।"],
        "attention_points_en": ["Hemoglobin (10.4 g/dL) and Vitamin D (14 ng/mL) were low; HbA1c (6.3%) was high."],
        "attention_points_hi": ["हीमोग्लोबिन (10.4 g/dL) और विटामिन D (14 ng/mL) कम थे; HbA1c (6.3%) अधिक था।"],
        "doctor_discussion_points_en": ["Track Hemoglobin, HbA1c, and Vitamin D in follow-up testing."],
        "doctor_discussion_points_hi": ["फॉलो-अप जांच में हीमोग्लोबिन, HbA1c और विटामिन D की प्रगति देखें।"],
        "simplified_terms": [],
        "disclaimer_en": Config.MEDICAL_DISCLAIMER_EN,
        "disclaimer_hi": Config.MEDICAL_DISCLAIMER_HI,
        "ai_mode": "demo",
    }


def compare_reports(previous_report: Dict[str, Any], latest_report: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministically matches comparable tests by name + unit and evaluates each change
    against its printed reference range (never assuming every increase is bad or good).
    """
    prev_tests = (previous_report.get("analysis") or {}).get("tests") or []
    latest_tests = (latest_report.get("analysis") or {}).get("tests") or []

    prev_map: Dict[str, Dict[str, Any]] = {}
    for t in prev_tests:
        prev_map[_canonical_test_key(t.get("test_name", ""))] = t

    latest_map: Dict[str, Dict[str, Any]] = {}
    for t in latest_tests:
        latest_map[_canonical_test_key(t.get("test_name", ""))] = t

    all_keys = list(dict.fromkeys([*prev_map.keys(), *latest_map.keys()]))
    rows: List[Dict[str, Any]] = []

    counts = {
        "improved": 0,
        "needs_attention": 0,
        "stable": 0,
        "insufficient": 0,
    }

    for key in all_keys:
        p = prev_map.get(key)
        l = latest_map.get(key)
        display_name = (l or p or {}).get("test_name", key.title())

        if not p or not l:
            counts["insufficient"] += 1
            rows.append(
                {
                    "test_name": display_name,
                    "previous_value": f"{p['result']} {p.get('unit', '')}".strip() if p else "Not in report",
                    "latest_value": f"{l['result']} {l.get('unit', '')}".strip() if l else "Not in report",
                    "previous_range": p.get("normal_range", "—") if p else "—",
                    "latest_range": l.get("normal_range", "—") if l else "—",
                    "indicator": "Insufficient data for comparison",
                    "indicator_code": "insufficient",
                    "explanation_en": "This test appears in only one of the two selected reports, so a trend cannot be calculated.",
                    "explanation_hi": "यह टेस्ट केवल एक ही रिपोर्ट में उपलब्ध है, इसलिए तुलना नहीं की जा सकती।",
                }
            )
            continue

        u_prev = _normalize_unit(p.get("unit", ""))
        u_lat = _normalize_unit(l.get("unit", ""))
        v_prev = _extract_number(p.get("result"))
        v_lat = _extract_number(l.get("result"))

        if (u_prev and u_lat and u_prev != u_lat) or v_prev is None or v_lat is None:
            counts["insufficient"] += 1
            rows.append(
                {
                    "test_name": display_name,
                    "previous_value": f"{p['result']} {p.get('unit', '')}".strip(),
                    "latest_value": f"{l['result']} {l.get('unit', '')}".strip(),
                    "previous_range": p.get("normal_range", "—"),
                    "latest_range": l.get("normal_range", "—"),
                    "indicator": "Insufficient data for comparison",
                    "indicator_code": "insufficient",
                    "explanation_en": "Units or test formats differ between the two reports; ask your doctor before comparing directly.",
                    "explanation_hi": "दोनों रिपोर्ट की इकाइयाँ (units) या प्रारूप भिन्न हैं; सीधी तुलना के लिए डॉक्टर से पूछें।",
                }
            )
            continue

        p_low, p_high = _parse_range(p.get("normal_range", ""))
        l_low, l_high = _parse_range(l.get("normal_range", ""))
        # Fall back to the other report's range if one omitted it
        if p_low is None and p_high is None:
            p_low, p_high = l_low, l_high
        if l_low is None and l_high is None:
            l_low, l_high = p_low, p_high

        d_prev = _distance_outside_range(v_prev, p_low, p_high)
        d_lat = _distance_outside_range(v_lat, l_low, l_high)
        delta = round(v_lat - v_prev, 2)
        unit = l.get("unit") or p.get("unit") or ""
        sign = "+" if delta > 0 else ""

        # Clinical context evaluation relative to reference range
        if d_prev == 0 and d_lat == 0:
            indicator = "Stable"
            code = "stable"
            counts["stable"] += 1
            exp_en = (
                f"Remained within the normal reference range ({v_prev} → {v_lat} {unit}, change {sign}{delta})."
            )
            exp_hi = (
                f"दोनों रिपोर्ट में सामान्य सीमा के भीतर स्थिर रहा ({v_prev} → {v_lat} {unit}, बदलाव {sign}{delta})।"
            )
        elif d_lat == 0 and d_prev > 0:
            indicator = "Improved relative to the reference range"
            code = "improved"
            counts["improved"] += 1
            exp_en = (
                f"Moved back into the normal reference range ({v_prev} → {v_lat} {unit}). Positive progress to review with your doctor."
            )
            exp_hi = (
                f"सामान्य संदर्भ सीमा के भीतर लौट आया ({v_prev} → {v_lat} {unit})। डॉक्टर के साथ साझा करने योग्य सकारात्मक सुधार।"
            )
        elif d_lat < d_prev - 1e-6:
            indicator = "Improved relative to the reference range"
            code = "improved"
            counts["improved"] += 1
            exp_en = (
                f"Moved closer to the reference range ({v_prev} → {v_lat} {unit}, change {sign}{delta}), though still outside the range — continue monitoring with your doctor."
            )
            exp_hi = (
                f"सामान्य सीमा के करीब आया ({v_prev} → {v_lat} {unit}, बदलाव {sign}{delta}), हालांकि अभी भी सीमा से बाहर है — डॉक्टर की निगरानी जारी रखें।"
            )
        elif d_lat > d_prev + 1e-6:
            indicator = "Needs attention"
            code = "needs_attention"
            counts["needs_attention"] += 1
            exp_en = (
                f"Moved further outside the reference range ({v_prev} → {v_lat} {unit}, change {sign}{delta}). Please discuss this trend with your doctor."
            )
            exp_hi = (
                f"सामान्य सीमा से और दूर गया ({v_prev} → {v_lat} {unit}, बदलाव {sign}{delta})। कृपया इस बदलाव पर अपने डॉक्टर से चर्चा करें।"
            )
        else:
            # Equal distance outside range (unchanged abnormal)
            indicator = "Needs attention" if d_lat > 0 else "Stable"
            code = "needs_attention" if d_lat > 0 else "stable"
            counts[code] += 1
            exp_en = (
                f"Remained essentially unchanged outside the reference range ({v_prev} → {v_lat} {unit}). Worth reviewing with your doctor."
            )
            exp_hi = (
                f"सामान्य सीमा से बाहर लगभग अपरिवर्तित रहा ({v_prev} → {v_lat} {unit})। डॉक्टर से समीक्षा करना उपयोगी होगा।"
            )

        rows.append(
            {
                "test_name": display_name,
                "previous_value": f"{p['result']} {p.get('unit', '')}".strip(),
                "latest_value": f"{l['result']} {l.get('unit', '')}".strip(),
                "previous_range": p.get("normal_range", "—"),
                "latest_range": l.get("normal_range", "—"),
                "delta": f"{sign}{delta} {unit}".strip(),
                "indicator": indicator,
                "indicator_code": code,
                "explanation_en": exp_en,
                "explanation_hi": exp_hi,
            }
        )

    summary_en = (
        f"Compared {len(rows)} lab tests between '{previous_report.get('title')}' and '{latest_report.get('title')}': "
        f"{counts['improved']} improved relative to the reference range, {counts['stable']} remained stable in range, "
        f"{counts['needs_attention']} need doctor attention, and {counts['insufficient']} had insufficient comparable data."
    )
    summary_hi = (
        f"'{previous_report.get('title')}' और '{latest_report.get('title')}' के बीच {len(rows)} टेस्ट की तुलना की गई: "
        f"{counts['improved']} में सामान्य सीमा की ओर सुधार हुआ, {counts['stable']} सामान्य सीमा में स्थिर रहे, "
        f"{counts['needs_attention']} पर डॉक्टर के ध्यान की आवश्यकता है, और {counts['insufficient']} के लिए पर्याप्त तुलनात्मक डेटा उपलब्ध नहीं था।"
    )

    return {
        "rows": rows,
        "counts": counts,
        "summary_en": summary_en,
        "summary_hi": summary_hi,
        "disclaimer_en": Config.MEDICAL_DISCLAIMER_EN,
        "disclaimer_hi": Config.MEDICAL_DISCLAIMER_HI,
    }


# =============================================================================
# MODULE 10: PERSONALIZED DIET & LIFESTYLE GUIDE
# =============================================================================


class FoodItemReason(BaseModel):
    item_en: str
    item_hi: str
    reason_en: str
    reason_hi: str


class ActivitySuggestion(BaseModel):
    activity_en: str
    activity_hi: str
    duration_frequency_en: str
    duration_frequency_hi: str
    benefit_en: str
    benefit_hi: str


class WeeklyDayPlan(BaseModel):
    day: str
    breakfast_en: str
    breakfast_hi: str
    lunch_en: str
    lunch_hi: str
    snack_en: str
    snack_hi: str
    dinner_en: str
    dinner_hi: str
    exercise_en: str
    exercise_hi: str
    rest_note_en: str
    rest_note_hi: str


class LifestylePlanSchema(BaseModel):
    overview_en: str
    overview_hi: str
    # Section A: Daily Diet and Lifestyle Guidance
    foods_to_include: List[FoodItemReason]
    foods_to_limit: List[FoodItemReason]
    physical_activities: List[ActivitySuggestion]
    daily_habits_en: List[str]
    daily_habits_hi: List[str]
    home_care_en: List[str]
    home_care_hi: List[str]
    # Section B: Weekly Diet and Exercise Plan
    weekly_plan: List[WeeklyDayPlan]


LIFESTYLE_SYSTEM_INSTRUCTION = """You are MedAi's Supportive Diet & Lifestyle Guide.
Generate safe, practical, culturally thoughtful Indian/general everyday diet, gentle exercise, and daily wellness guidance based on the user's preferences, allergies, mobility limits, medical restrictions, and optional lab report context.

STRICT SAFETY RULES:
1. NEVER recommend stopping, reducing, skipping, or replacing any prescribed medication.
2. Strictly respect every allergy, dietary preference (e.g., Vegetarian, Vegan, Eggetarian, Non-Veg), and mobility limitation.
3. Recommend only gentle, safe, evidence-based home-care and wellness habits — no extreme diets, unverified herbal cures, or unsafe physical strain.
4. Provide every recommendation clearly in BOTH English and natural Hindi (Devanagari).
5. Always provide a full 7-day weekly_plan (Monday through Sunday).
"""


def _build_demo_lifestyle_plan(profile: Dict[str, Any], report: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    diet_pref = profile.get("dietary_preference") or "Vegetarian"
    allergies = profile.get("allergies") or "None noted"
    mobility = profile.get("mobility_limitations") or "None noted"
    has_report = bool(report)

    days = [
        ("Monday", "सोमवार", "Oats porridge with chia seeds & apple", "चिया सीड्स और सेब के साथ ओट्स दलिया", "Dal, palak sabzi, 2 multigrain rotis & cucumber salad", "दाल, पालक की सब्ज़ी, 2 मल्टीग्रेन रोटी और खीरा सलाद", "Roasted chana & green tea", "भुना चना और ग्रीन टी", "Vegetable khichdi with curd", "सब्ज़ी खिचड़ी और दही", "25-min brisk walk", "25 मिनट तेज़ टहलना", "7–8 hrs sleep; 10-min evening stretch", "7–8 घंटे नींद; शाम को 10 मिनट स्ट्रेचिंग"),
        ("Tuesday", "मंगलवार", "Moong dal chilla with mint chutney", "पुदीना चटनी के साथ मूंग दाल चीला", "Rajma, small portion brown rice & salad", "राजमा, थोड़ी ब्राउन राइस और सलाद", "Handful of soaked almonds & walnuts", "भिगोए बादाम और अखरोट", "Grilled paneer/tofu & sautéed veggies", "ग्रिल्ड पनीर/टोफू और हल्की भुनी सब्ज़ियाँ", "20-min gentle yoga & pranayama", "20 मिनट हल्का योग और प्राणायाम", "Hydrate well; take short screen breaks", "पर्याप्त पानी पिएं; स्क्रीन से छोटे ब्रेक लें"),
        ("Wednesday", "बुधवार", "Vegetable poha with peanuts & lemon", "मूंगफली और नींबू के साथ वेजिटेबल पोहा", "Chana dal, lauki sabzi, 2 rotis & buttermilk", "चना दाल, लौकी सब्ज़ी, 2 रोटी और छाछ", "Seasonal fruit (guava/pear)", "मौसमी फल (अमरूद/नाशपाती)", "Mixed veg soup & whole-wheat toast", "मिक्स वेज सूप और होल-व्हीट टोस्ट", "30-min steady walk", "30 मिनट नियमित टहलना", "Light reading before bed; avoid late caffeine", "सोने से पहले हल्का विश्राम; शाम को कैफीन से बचें"),
        ("Thursday", "गुरुवार", "Vegetable upma with roasted flaxseed", "भुने अलसी के साथ वेजिटेबल उपमा", "Sambar, 2 idlis or millet roti & salad", "सांभर, 2 इडली या मिलेट रोटी और सलाद", "Makhana roasted with light spices", "हल्के मसाले के साथ भुना मखाना", "Methi roti with dal & steamed broccoli", "मेथी रोटी, दाल और भाप में पकी ब्रोकली", "20-min light strength/chair exercises", "20 मिनट हल्के स्ट्रेन्थ/चेयर व्यायाम", "Focus on calm breathing for 5 mins", "5 मिनट शांत गहरी सांस लें"),
        ("Friday", "शुक्रवार", "Besan chilla with spinach & grated carrot", "पालक और गाजर के साथ बेसन चीला", "Masoor dal, bhindi, 2 rotis & kachumber", "मसूर दाल, भिंडी, 2 रोटी और कचूमर सलाद", "Sprouts chaat with lemon", "नींबू के साथ अंकुरित चाट", "Dalia khichdi with seasonal vegetables", "मौसमी सब्ज़ियों के साथ दलिया खिचड़ी", "25-min morning walk + gentle stretch", "25 मिनट सुबह की सैर + स्ट्रेचिंग", "15 mins morning sunlight for Vitamin D", "विटामिन D के लिए 15 मिनट सुबह की धूप"),
        ("Saturday", "शनिवार", "Whole-wheat veg sandwich / stuffed paratha (minimal oil)", "कम तेल में वेज सैंडविच / सब्ज़ी पराठा", "Kadhi or dal, bajra/jowar roti & salad", "कढ़ी या दाल, बाजरा/ज्वार रोटी और सलाद", "Unsweetened yogurt with berries/pomegranate", "बिना चीनी दही और अनार", "Clear vegetable stew & sautéed greens", "सब्ज़ी स्ट्यू और हरी पत्तेदार सब्ज़ी", "30-min outdoor walk or cycling", "30 मिनट बाहरी सैर या हल्की साइक्लिंग", "Unwind with family or relaxing music", "परिवार या शांत संगीत के साथ तनाव कम करें"),
        ("Sunday", "रविवार", "Idli with sambar or vegetable daliya", "इडली-सांभर या वेजिटेबल दलिया", "Balanced home thali (dal, 2 veggies, salad, curd, 2 rotis)", "संतुलित घर की थाली (दाल, 2 सब्ज़ी, सलाद, दही, 2 रोटी)", "Coconut water or roasted seeds", "नारियल पानी या भुने बीज", "Light moong soup & stir-fried vegetables", "हल्का मूंग सूप और हल्की भुनी सब्ज़ियाँ", "Active rest: 15-min easy stroll & mobility stretch", "सक्रिय विश्राम: 15 मिनट हल्की सैर और स्ट्रेचिंग", "Prep healthy ingredients for the week ahead", "आने वाले सप्ताह के लिए स्वस्थ भोजन की तैयारी करें"),
    ]

    return {
        "overview_en": (
            f"A balanced, practical wellness guide tailored for a {diet_pref} lifestyle "
            f"(Allergies considered: {allergies}; Mobility: {mobility})"
            + (f", informed by your report '{report.get('title')}'." if has_report else ".")
        ),
        "overview_hi": (
            f"आपकी {diet_pref} पसंद (एलर्जी: {allergies}; गतिशीलता: {mobility}) के अनुसार तैयार संतुलित दैनिक "
            "व साप्ताहिक स्वास्थ्य मार्गदर्शन"
            + (f", आपकी रिपोर्ट '{report.get('title')}' के संदर्भ सहित।" if has_report else "।")
        ),
        "foods_to_include": [
            {
                "item_en": "Iron- & folate-rich leafy greens (spinach, methi, amaranth) paired with Vitamin C (lemon/amla)",
                "item_hi": "आयरन और फोलेट युक्त हरी सब्ज़ियाँ (पालक, मेथी, चौलाई) नींबू/आंवला के साथ",
                "reason_en": "Vitamin C helps your body absorb plant-based iron more effectively to support healthy hemoglobin.",
                "reason_hi": "विटामिन C वनस्पति स्रोतों से आयरन के अवशोषण को बेहतर बनाता है, जो हीमोग्लोबिन के लिए सहायक है।",
            },
            {
                "item_en": "High-fiber whole grains & legumes (oats, millets, dal, chana, rajma)",
                "item_hi": "फाइबर युक्त साबुत अनाज और दालें (ओट्स, मिलेट्स, दाल, चना, राजमा)",
                "reason_en": "Slow-digesting complex carbohydrates help keep energy steady and avoid sharp post-meal blood sugar spikes.",
                "reason_hi": "धीमे पचने वाले फाइबर युक्त अनाज भोजन के बाद ब्लड शुगर को अचानक बढ़ने से रोकने में मदद करते हैं।",
            },
            {
                "item_en": "Fortified dairy/plant milk, mushrooms, nuts & seeds",
                "item_hi": "दही/दूध, मशरूम, बादाम, अखरोट और अलसी के बीज",
                "reason_en": "Provide protein, healthy fats, calcium, and supportive micronutrients alongside safe morning sunlight.",
                "reason_hi": "प्रोटीन, स्वस्थ वसा और सूक्ष्म पोषक तत्व प्रदान करते हैं।",
            },
        ],
        "foods_to_limit": [
            {
                "item_en": "Sugary drinks, packaged juices, and refined sweets",
                "item_hi": "मीठे पेय, पैक्ड जूस और रिफाइंड मिठाइयाँ",
                "reason_en": "Rapidly raise blood glucose and add empty calories without sustaining fullness.",
                "reason_hi": "ये ब्लड शुगर को तेजी से बढ़ाते हैं और शरीर को उपयोगी पोषण नहीं देते।",
            },
            {
                "item_en": "Deep-fried snacks & ultra-processed salty foods",
                "item_hi": "अधिक तला हुआ और अत्यधिक प्रोसेस्ड नमकीन भोजन",
                "reason_en": "High trans/saturated fats and excess sodium can strain cardiovascular and metabolic health.",
                "reason_hi": "अधिक नमक और अस्वस्थ वसा हृदय और मेटाबॉलिक सेहत पर अतिरिक्त दबाव डाल सकते हैं।",
            },
            {
                "item_en": "Drinking tea/coffee immediately with iron-rich meals",
                "item_hi": "भोजन के तुरंत साथ चाय या कॉफ़ी पीना",
                "reason_en": "Tannins in tea and coffee can reduce iron absorption; spacing them 45–60 minutes after meals helps.",
                "reason_hi": "चाय/कॉफ़ी के टैनिन आयरन के अवशोषण को कम कर सकते हैं; भोजन के 45–60 मिनट बाद लेना बेहतर है।",
            },
        ],
        "physical_activities": [
            {
                "activity_en": "Brisk Walking (or comfortable low-impact indoor walking)",
                "activity_hi": "तेज़ टहलना (या आरामदायक गति से चलना)",
                "duration_frequency_en": "25–30 minutes, 5 days/week (or two 15-min post-meal walks)",
                "duration_frequency_hi": "25–30 मिनट, सप्ताह में 5 दिन (या भोजन के बाद 15 मिनट की सैर)",
                "benefit_en": "Supports blood sugar balance, heart stamina, and gentle daily circulation.",
                "benefit_hi": "ब्लड शुगर संतुलन, हृदय की सेहत और रक्त संचार में मदद करता है।",
            },
            {
                "activity_en": "Gentle Yoga, Stretching & Deep Breathing (Pranayama)",
                "activity_hi": "हल्का योग, स्ट्रेचिंग और प्राणायाम",
                "duration_frequency_en": "15–20 minutes, 3–4 days/week",
                "duration_frequency_hi": "15–20 मिनट, सप्ताह में 3–4 दिन",
                "benefit_en": "Improves joint flexibility, lowers stress hormones, and supports restful sleep.",
                "benefit_hi": "जोड़ों के लचीलेपन, तनाव कम करने और बेहतर नींद में सहायक।",
            },
        ],
        "daily_habits_en": [
            "Sleep: Aim for 7–8 hours with consistent sleep and wake times.",
            "Hydration: Drink 7–8 glasses of water spread steadily through the day (adjust if your doctor gave fluid limits).",
            "Post-meal movement: A calm 10-minute walk after dinner supports digestion and glucose control.",
            "Stress care: Take 5 minutes of slow nasal breathing (4s inhale, 6s exhale) during busy afternoons.",
        ],
        "daily_habits_hi": [
            "नींद: प्रतिदिन निश्चित समय पर 7–8 घंटे की गुणवत्तापूर्ण नींद लें।",
            "हाइड्रेशन: दिनभर में 7–8 गिलास पानी पिएं (यदि डॉक्टर ने पानी की सीमा तय की हो तो उसी का पालन करें)।",
            "भोजन के बाद टहलना: रात के खाने के बाद 10 मिनट हल्का टहलना पाचन व शुगर संतुलन में मदद करता है।",
            "तनाव प्रबंधन: दिन में 5 मिनट धीमी गहरी सांस लेने का अभ्यास करें।",
        ],
        "home_care_en": [
            "Spend 15 minutes in gentle morning sunlight (before 10 AM) when comfortable.",
            "Keep a simple weekly notebook of energy levels, meal timing, and questions for your next doctor appointment.",
        ],
        "home_care_hi": [
            "सुविधा अनुसार सुबह 10 बजे से पहले 15 मिनट हल्की धूप लें।",
            "अपनी ऊर्जा, भोजन के समय और डॉक्टर से पूछने वाले सवालों की एक छोटी डायरी रखें।",
        ],
        "weekly_plan": [
            {
                "day": d[0],
                "breakfast_en": d[2],
                "breakfast_hi": d[3],
                "lunch_en": d[4],
                "lunch_hi": d[5],
                "snack_en": d[6],
                "snack_hi": d[7],
                "dinner_en": d[8],
                "dinner_hi": d[9],
                "exercise_en": d[10],
                "exercise_hi": d[11],
                "rest_note_en": d[12],
                "rest_note_hi": d[13],
            }
            for d in days
        ],
        "mandatory_disclaimer_en": LIFESTYLE_MANDATORY_DISCLAIMER_EN,
        "mandatory_disclaimer_hi": LIFESTYLE_MANDATORY_DISCLAIMER_HI,
        "ai_mode": "demo",
    }


def generate_lifestyle_plan(profile: Dict[str, Any], report: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not is_gemini_configured():
        return _build_demo_lifestyle_plan(profile, report)

    report_ctx = _format_report_context(report)
    prompt = (
        "Create a personalized, supportive Daily Diet & Lifestyle Guide (Section A) and a 7-day Weekly Diet & Exercise Plan (Section B) "
        f"for the following patient profile:\n"
        f"- Age: {profile.get('age') or 'Not specified'}\n"
        f"- Dietary Preference: {profile.get('dietary_preference') or 'Balanced'}\n"
        f"- Allergies: {profile.get('allergies') or 'None'}\n"
        f"- Mobility Limitations: {profile.get('mobility_limitations') or 'None'}\n"
        f"- Known Medical Restrictions / Goals: {profile.get('medical_restrictions') or 'General wellness'}\n"
        f"{report_ctx}\n"
        "Respond in structured JSON with clear English and Hindi fields."
    )

    interaction = create_interaction_with_fallback(
        model=Config.GEMINI_MODEL,
        system_instruction=LIFESTYLE_SYSTEM_INSTRUCTION,
        input=prompt,
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": LifestylePlanSchema.model_json_schema(),
        },
    )
    data = LifestylePlanSchema.model_validate_json(interaction.output_text).model_dump()
    data["mandatory_disclaimer_en"] = LIFESTYLE_MANDATORY_DISCLAIMER_EN
    data["mandatory_disclaimer_hi"] = LIFESTYLE_MANDATORY_DISCLAIMER_HI
    data["ai_mode"] = "live-gemini"
    return data


# =============================================================================
# MODULE 11: MEDICAL DICTIONARY
# =============================================================================

CURATED_DICTIONARY: List[Dict[str, Any]] = [
    {
        "term": "Hemoglobin (Hb)",
        "category": "Blood Test",
        "definition_en": "An iron-rich protein inside red blood cells that carries oxygen from your lungs to tissues across your body.",
        "definition_hi": "लाल रक्त कोशिकाओं में मौजूद आयरन-युक्त प्रोटीन जो फेफड़ों से पूरे शरीर के ऊतकों तक ऑक्सीजन पहुँचाता है।",
        "example_en": "A low hemoglobin reading may make someone feel tired or short of breath and is often discussed with a doctor to check iron or vitamin levels.",
        "example_hi": "कम हीमोग्लोबिन होने पर थकान या कमजोरी महसूस हो सकती है; डॉक्टर इसके कारण जानने के लिए आगे जांच की सलाह दे सकते हैं।",
        "match_keywords": ["hemoglobin", "haemoglobin", "hb", "hgb"],
    },
    {
        "term": "HbA1c (Glycated Hemoglobin)",
        "category": "Blood Sugar",
        "definition_en": "A blood test that estimates your average blood glucose (sugar) level over the past 2 to 3 months.",
        "definition_hi": "एक रक्त जांच जो पिछले 2 से 3 महीनों के औसत ब्लड शुगर स्तर का अनुमान बताती है।",
        "example_en": "Unlike a single fasting sugar reading, HbA1c shows the longer-term pattern of blood sugar control.",
        "example_hi": "एक दिन की फास्टिंग शुगर के बजाय HbA1c लंबे समय के ब्लड शुगर पैटर्न को दर्शाता है।",
        "match_keywords": ["hba1c", "a1c", "glycated"],
    },
    {
        "term": "Fasting Blood Glucose (FBS)",
        "category": "Blood Sugar",
        "definition_en": "The concentration of sugar in your blood measured after not eating or drinking calories for 8–12 hours.",
        "definition_hi": "8–12 घंटे खाली पेट रहने के बाद रक्त में मापी गई ग्लूकोज़ (शुगर) की मात्रा।",
        "example_en": "Doctors commonly ask you to take an FBS test first thing in the morning before breakfast.",
        "example_hi": "डॉक्टर आमतौर पर सुबह नाश्ते से पहले खाली पेट यह जांच कराने की सलाह देते हैं।",
        "match_keywords": ["glucose", "fbs", "blood sugar"],
    },
    {
        "term": "Serum Creatinine",
        "category": "Kidney Health",
        "definition_en": "A natural waste product created by normal muscle activity that healthy kidneys filter out through urine.",
        "definition_hi": "मांसपेशियों की सामान्य गतिविधि से बनने वाला प्राकृतिक अपशिष्ट जिसे स्वस्थ किडनी पेशाब के जरिए बाहर निकालती है।",
        "example_en": "A normal creatinine level generally reflects healthy kidney filtration.",
        "example_hi": "सामान्य क्रिएटिनिन मान आमतौर पर किडनी के स्वस्थ कामकाज का संकेत होता है।",
        "match_keywords": ["creatinine"],
    },
    {
        "term": "TSH (Thyroid Stimulating Hormone)",
        "category": "Thyroid",
        "definition_en": "A hormone released by the pituitary gland in the brain that tells your thyroid gland how much hormone to make.",
        "definition_hi": "मस्तिष्क की पिट्यूटरी ग्रंथि से निकलने वाला हार्मोन जो थायरॉइड ग्रंथि को नियंत्रित करता है।",
        "example_en": "Doctors check TSH to see if the thyroid is working normally, underactive, or overactive.",
        "example_hi": "डॉक्टर TSH जांच से देखते हैं कि थायरॉइड सामान्य, कम सक्रिय या अधिक सक्रिय तो नहीं है।",
        "match_keywords": ["tsh", "thyroid"],
    },
    {
        "term": "Total Cholesterol & Lipid Profile",
        "category": "Heart Health",
        "definition_en": "A group of blood tests measuring fats (LDL 'bad', HDL 'good', and Triglycerides) circulating in the bloodstream.",
        "definition_hi": "रक्त में मौजूद विभिन्न वसा (LDL, HDL और ट्राइग्लिसराइड्स) को मापने वाली जांचों का समूह।",
        "example_en": "Keeping total cholesterol and LDL in target ranges supports long-term heart and blood vessel health.",
        "example_hi": "कुल कोलेस्ट्रॉल और LDL को सामान्य सीमा में रखना हृदय और रक्त वाहिकाओं के स्वास्थ्य के लिए उपयोगी है।",
        "match_keywords": ["cholesterol", "ldl", "hdl", "lipid", "triglyceride"],
    },
    {
        "term": "Vitamin D (25-OH)",
        "category": "Vitamins",
        "definition_en": "A key nutrient produced through sunlight exposure and diet that supports bone strength, calcium absorption, and immunity.",
        "definition_hi": "धूप और आहार से मिलने वाला आवश्यक पोषक तत्व जो हड्डियों की मजबूती, कैल्शियम अवशोषण और रोग प्रतिरोधक क्षमता में मदद करता है।",
        "example_en": "Low Vitamin D is very common in people who work mostly indoors.",
        "example_hi": "अधिकतर घर/ऑफ़िस के अंदर रहने वाले लोगों में विटामिन D की कमी काफी सामान्य है।",
        "match_keywords": ["vitamin d", "25-oh"],
    },
    {
        "term": "Platelet Count (PLT)",
        "category": "Blood Test",
        "definition_en": "Tiny blood cell fragments that help stop bleeding by forming clots when a blood vessel is injured.",
        "definition_hi": "रक्त की छोटी कोशिकाएँ जो चोट लगने पर थक्का जमाकर रक्तस्राव रोकने में मदद करती हैं।",
        "example_en": "Platelet counts are often monitored during viral fevers such as dengue.",
        "example_hi": "डेंगू जैसे वायरल बुखार में अक्सर प्लेटलेट काउंट की निगरानी की जाती है।",
        "match_keywords": ["platelet", "plt"],
    },
    {
        "term": "OD / BD / TDS / HS / SOS (Prescription Abbreviations)",
        "category": "Prescription Terms",
        "definition_en": "Standard timing shorthand: OD = once daily, BD = twice daily, TDS = three times daily, HS = at bedtime, SOS = only if needed, AC = before meals, PC = after meals.",
        "definition_hi": "दवाई के समय के संक्षिप्त रूप: OD = दिन में एक बार, BD = दिन में दो बार, TDS = दिन में तीन बार, HS = रात को सोते समय, SOS = केवल जरूरत पड़ने पर, AC = खाने से पहले, PC = खाने के बाद।",
        "example_en": "'1 Tab BD PC' means one tablet twice a day after food.",
        "example_hi": "'1 Tab BD PC' का अर्थ है भोजन के बाद दिन में दो बार एक गोली।",
        "match_keywords": ["od", "bd", "tds", "hs", "sos", "pc", "ac"],
    },
]


class DictionaryEntrySchema(BaseModel):
    term: str
    category: str
    definition_en: str
    definition_hi: str
    example_en: str
    example_hi: str


def _find_related_report_tests(query: str, user_reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    q = (query or "").lower().strip()
    tokens = [w for w in re.split(r"[^a-z0-9]+", q) if len(w) >= 2]
    matches: List[Dict[str, Any]] = []
    for rep in user_reports:
        for t in (rep.get("analysis") or {}).get("tests") or []:
            tname = (t.get("test_name") or "").lower()
            if q and (q in tname or tname in q or any(tok in tname for tok in tokens)):
                matches.append(
                    {
                        "report_id": rep["id"],
                        "report_title": rep["title"],
                        "report_date": rep.get("report_date") or rep.get("created_at", "")[:10],
                        "test_name": t.get("test_name"),
                        "result": f"{t.get('result', '')} {t.get('unit', '')}".strip(),
                        "normal_range": t.get("normal_range", ""),
                        "status": t.get("status", "Unknown"),
                    }
                )
    return matches[:6]


def lookup_medical_term(query: str, user_reports: List[Dict[str, Any]]) -> Dict[str, Any]:
    q = (query or "").strip()
    q_low = q.lower()

    # Check curated glossary first for instant match
    for item in CURATED_DICTIONARY:
        if q_low in item["term"].lower() or any(k == q_low or (len(k) >= 3 and k in q_low) for k in item["match_keywords"]):
            return {
                "entry": {
                    "term": item["term"],
                    "category": item["category"],
                    "definition_en": item["definition_en"],
                    "definition_hi": item["definition_hi"],
                    "example_en": item["example_en"],
                    "example_hi": item["example_hi"],
                },
                "related_report_tests": _find_related_report_tests(q, user_reports),
                "source": "curated",
            }

    if is_gemini_configured():
        interaction = create_interaction_with_fallback(
            model=Config.GEMINI_MODEL,
            system_instruction=(
                "You are MedAi's Medical Dictionary. Explain medical terms and clinical abbreviations "
                "in plain, patient-friendly English and Hindi (Devanagari) with a simple everyday example. "
                "Educational information only — never diagnose or prescribe."
            ),
            input=f"Explain the medical term or abbreviation: '{q}'",
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": DictionaryEntrySchema.model_json_schema(),
            },
        )
        entry = DictionaryEntrySchema.model_validate_json(interaction.output_text).model_dump()
        return {
            "entry": entry,
            "related_report_tests": _find_related_report_tests(q, user_reports),
            "source": "live-gemini",
        }

    # Demo fallback for custom term when Gemini API key is not configured
    return {
        "entry": {
            "term": q,
            "category": "Medical Term",
            "definition_en": (
                f"'{q}' is a medical term or clinical abbreviation. In Demo Mode, instant definitions are available for "
                "our curated terms (e.g., Hemoglobin, HbA1c, Creatinine, TSH, Cholesterol, Vitamin D, Platelets, BD/OD/PC). "
                "Add GEMINI_API_KEY in backend/.env to look up any medical term with Gemini 3.8 Flash."
            ),
            "definition_hi": (
                f"'{q}' एक मेडिकल शब्द या संक्षिप्त रूप है। डेमो मोड में प्रमुख मेडिकल शब्दों (जैसे Hemoglobin, HbA1c, Creatinine, TSH, Vitamin D, BD/OD) "
                "की तत्काल व्याख्या उपलब्ध है। किसी भी शब्द की लाइव व्याख्या के लिए backend/.env में GEMINI_API_KEY जोड़ें।"
            ),
            "example_en": "Tip: Try searching 'HbA1c', 'Hemoglobin', 'TSH', or 'BD' — or ask your doctor to clarify how this term relates to your report.",
            "example_hi": "सुझाव: 'HbA1c', 'Hemoglobin', 'TSH' या 'BD' खोजकर देखें — या अपने डॉक्टर से इस शब्द का संदर्भ पूछें।",
        },
        "related_report_tests": _find_related_report_tests(q, user_reports),
        "source": "demo",
    }


# =============================================================================
# MODULE 12: DOCTOR VISIT PREPARATION
# =============================================================================


class DoctorPrepSchema(BaseModel):
    short_report_summary_en: str
    short_report_summary_hi: str
    key_topics_to_discuss_en: List[str]
    key_topics_to_discuss_hi: List[str]
    suggested_questions_en: List[str]
    suggested_questions_hi: List[str]
    organized_concerns_en: List[str]
    organized_concerns_hi: List[str]
    checklist_items_en: List[str]
    checklist_items_hi: List[str]


def generate_doctor_prep(
    report: Optional[Dict[str, Any]],
    concerns: List[str],
    visit_goal: str = "",
) -> Dict[str, Any]:
    clean_concerns = [c.strip() for c in concerns if c and c.strip()]

    if not is_gemini_configured():
        analysis = (report or {}).get("analysis") or {}
        attention_en = analysis.get("attention_points_en") or []
        attention_hi = analysis.get("attention_points_hi") or []
        doc_q_en = list(analysis.get("doctor_discussion_points_en") or [])
        doc_q_hi = list(analysis.get("doctor_discussion_points_hi") or [])

        if not doc_q_en:
            doc_q_en = [
                "Are any follow-up tests needed based on my current health and symptoms?",
                "What daily habits or warning signs should I monitor at home?",
                "When should I schedule my next check-up?",
            ]
            doc_q_hi = [
                "क्या मेरी वर्तमान स्थिति और लक्षणों के अनुसार किसी अतिरिक्त जांच की आवश्यकता है?",
                "मुझे घर पर किन दैनिक आदतों या चेतावनी संकेतों पर ध्यान देना चाहिए?",
                "अगली जांच या मुलाकात कब निर्धारित करनी चाहिए?",
            ]

        if visit_goal:
            doc_q_en.insert(0, f"Regarding my main goal ({visit_goal}): what next steps do you recommend?")
            doc_q_hi.insert(0, f"मेरे मुख्य उद्देश्य ({visit_goal}) के लिए आप अगले कौन से कदम सुझाते हैं?")

        return {
            "short_report_summary_en": analysis.get("summary_en")
            or "General doctor visit preparation sheet with your organized symptoms, questions, and health priorities.",
            "short_report_summary_hi": analysis.get("summary_hi")
            or "आपके लक्षणों, प्रश्नों और स्वास्थ्य प्राथमिकताओं के साथ डॉक्टर मुलाकात की तैयारी शीट।",
            "key_topics_to_discuss_en": attention_en
            or ["Review overall health check-up status and routine preventive screenings."],
            "key_topics_to_discuss_hi": attention_hi
            or ["सामान्य स्वास्थ्य स्थिति और नियमित जांच की समीक्षा करें।"],
            "suggested_questions_en": doc_q_en,
            "suggested_questions_hi": doc_q_hi,
            "organized_concerns_en": clean_concerns or ["No personal concerns added yet — add symptoms or questions above."],
            "organized_concerns_hi": clean_concerns or ["अभी कोई व्यक्तिगत चिंता नहीं जोड़ी गई है — ऊपर अपने लक्षण या सवाल जोड़ें।"],
            "checklist_items_en": [
                "Carry printed or digital copies of your latest and previous lab reports.",
                "Bring a full list of current prescriptions, over-the-counter medicines, and supplements.",
                "Note down any allergies and when your symptoms started.",
            ],
            "checklist_items_hi": [
                "अपनी नवीनतम और पिछली लैब रिपोर्ट की कॉपी साथ रखें।",
                "वर्तमान में ली जा रही सभी दवाइयों और सप्लीमेंट्स की सूची साथ ले जाएं।",
                "किसी भी एलर्जी और लक्षण शुरू होने के समय को नोट करके रखें।",
            ],
            "disclaimer_en": Config.MEDICAL_DISCLAIMER_EN,
            "disclaimer_hi": Config.MEDICAL_DISCLAIMER_HI,
            "ai_mode": "demo",
        }

    report_ctx = _format_report_context(report)
    prompt = (
        f"Prepare a concise, well-organized Doctor Visit Preparation brief in English and Hindi.\n"
        f"Visit Goal: {visit_goal or 'Routine review'}\n"
        f"Patient's Personal Concerns: {', '.join(clean_concerns) if clean_concerns else 'None listed'}\n"
        f"{report_ctx}\n"
        "Generate a short report summary, key topics to discuss, practical questions for the doctor, "
        "organized patient concerns, and a visit checklist. Do NOT diagnose or prescribe."
    )

    interaction = create_interaction_with_fallback(
        model=Config.GEMINI_MODEL,
        system_instruction=(
            "You are MedAi's Doctor Visit Preparation assistant. Organize the patient's report findings and "
            "concerns into clear, respectful questions for their physician in both English and Hindi. "
            "Never diagnose diseases or prescribe treatments."
        ),
        input=prompt,
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": DoctorPrepSchema.model_json_schema(),
        },
    )
    data = DoctorPrepSchema.model_validate_json(interaction.output_text).model_dump()
    data["disclaimer_en"] = Config.MEDICAL_DISCLAIMER_EN
    data["disclaimer_hi"] = Config.MEDICAL_DISCLAIMER_HI
    data["ai_mode"] = "live-gemini"
    return data

