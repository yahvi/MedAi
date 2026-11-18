"""
Module 13: Important Health Alerts — Deterministic Clinical Rules Engine.

Critical / urgent classifications are ALWAYS derived from validated, deterministic
numeric thresholds rather than unrestricted AI interpretation.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


# Validated adult critical/urgent lab value thresholds (common clinical panic values).
# Each rule specifies aliases, expected unit keywords, and (critical_low, critical_high).
CRITICAL_RULES: List[Dict[str, Any]] = [
    {
        "id": "hemoglobin",
        "label": "Hemoglobin",
        "aliases": ["hemoglobin", "haemoglobin", "hb", "hgb"],
        "unit_hints": ["g/dl", "gm/dl", "g/l"],
        "critical_low": 7.0,
        "critical_high": 20.0,
        "guidance_en": (
            "This hemoglobin level falls in a potentially urgent range. "
            "Please contact your doctor promptly for clinical evaluation—especially if you experience "
            "dizziness, shortness of breath, chest pain, or unusual fatigue."
        ),
        "guidance_hi": (
            "यह हीमोग्लोबिन स्तर तुरंत ध्यान देने योग्य (urgent) सीमा में है। "
            "कृपया शीघ्र ही अपने डॉक्टर से संपर्क करें—विशेषकर यदि आपको चक्कर, सांस फूलना, सीने में दर्द या अत्यधिक थकान महसूस हो।"
        ),
    },
    {
        "id": "glucose",
        "label": "Blood Glucose",
        "aliases": [
            "glucose",
            "fasting blood sugar",
            "fbs",
            "random blood sugar",
            "rbs",
            "ppbs",
            "blood sugar",
            "fasting glucose",
        ],
        "unit_hints": ["mg/dl"],
        "critical_low": 54.0,
        "critical_high": 300.0,
        "guidance_en": (
            "This blood glucose value is in a potentially urgent range. "
            "Please seek prompt medical advice from your healthcare provider, particularly if you notice "
            "shakiness, confusion, excessive thirst, nausea, or weakness."
        ),
        "guidance_hi": (
            "यह ब्लड शुगर (ग्लूकोज़) मान तुरंत ध्यान देने योग्य सीमा में है। "
            "कृपया शीघ्र ही डॉक्टर से सलाह लें, खासकर यदि कंपकंपी, भ्रम, अत्यधिक प्यास, मतली या कमजोरी हो।"
        ),
    },
    {
        "id": "potassium",
        "label": "Serum Potassium",
        "aliases": ["potassium", "serum potassium", "k+", "k (potassium)"],
        "unit_hints": ["meq/l", "mmol/l"],
        "critical_low": 2.8,
        "critical_high": 6.0,
        "guidance_en": (
            "Potassium values outside safe limits can affect heart rhythm. "
            "Please contact your doctor or urgent care promptly to review this result."
        ),
        "guidance_hi": (
            "पोटैशियम का स्तर सुरक्षित सीमा से बहुत बाहर होने पर हृदय की धड़कन प्रभावित हो सकती है। "
            "कृपया इस रिपोर्ट की समीक्षा के लिए तुरंत अपने डॉक्टर से संपर्क करें।"
        ),
    },
    {
        "id": "sodium",
        "label": "Serum Sodium",
        "aliases": ["sodium", "serum sodium", "na+"],
        "unit_hints": ["meq/l", "mmol/l"],
        "critical_low": 125.0,
        "critical_high": 155.0,
        "guidance_en": (
            "This sodium level is in a potentially urgent range. "
            "Please reach out to your healthcare professional promptly for evaluation."
        ),
        "guidance_hi": (
            "यह सोडियम स्तर तुरंत ध्यान देने योग्य सीमा में है। "
            "कृपया मूल्यांकन के लिए शीघ्र ही अपने डॉक्टर से संपर्क करें।"
        ),
    },
    {
        "id": "creatinine",
        "label": "Serum Creatinine",
        "aliases": ["creatinine", "serum creatinine", "s. creatinine"],
        "unit_hints": ["mg/dl"],
        "critical_low": None,
        "critical_high": 4.0,
        "guidance_en": (
            "Significantly elevated creatinine warrants prompt review by a doctor to assess kidney function."
        ),
        "guidance_hi": (
            "क्रिएटिनिन का अत्यधिक बढ़ा हुआ स्तर किडनी की कार्यप्रणाली की जांच के लिए डॉक्टर द्वारा शीघ्र समीक्षा मांगता है।"
        ),
    },
    {
        "id": "platelets",
        "label": "Platelet Count",
        "aliases": ["platelet", "platelets", "platelet count", "plt"],
        "unit_hints": ["lakh", "10^3", "k/ul", "x10", "/ul", "/cumm", "thousand"],
        "critical_low": 50.0,  # normalized to thousands/uL (e.g. 50,000/uL -> 50)
        "critical_high": 1000.0,
        "guidance_en": (
            "This platelet count is in a potentially urgent range. "
            "Please contact your doctor promptly, especially if you notice easy bruising, bleeding gums, or tiny red spots on the skin."
        ),
        "guidance_hi": (
            "यह प्लेटलेट काउंट तुरंत ध्यान देने योग्य सीमा में है। "
            "कृपया शीघ्र ही अपने डॉक्टर से संपर्क करें, खासकर यदि आसानी से नील पड़ना या रक्तस्राव के लक्षण दिखें।"
        ),
    },
    {
        "id": "wbc",
        "label": "WBC Count",
        "aliases": ["wbc", "total leukocyte count", "tlc", "white blood cell"],
        "unit_hints": ["10^3", "k/ul", "/ul", "/cumm", "cells"],
        "critical_low": 2.0,  # normalized to thousands/uL
        "critical_high": 30.0,
        "guidance_en": (
            "This white blood cell count is significantly outside the typical range. "
            "Please consult your doctor promptly for clinical review."
        ),
        "guidance_hi": (
            "यह श्वेत रक्त कोशिका (WBC) संख्या सामान्य सीमा से काफी बाहर है। "
            "कृपया नैदानिक समीक्षा के लिए शीघ्र ही अपने डॉक्टर से परामर्श करें।"
        ),
    },
    {
        "id": "hba1c",
        "label": "HbA1c",
        "aliases": ["hba1c", "glycated hemoglobin", "glycosylated hemoglobin", "a1c"],
        "unit_hints": ["%"],
        "critical_low": None,
        "critical_high": 11.0,
        "guidance_en": (
            "An HbA1c level this elevated indicates persistently high blood sugar over recent months. "
            "Please schedule a prompt review with your physician."
        ),
        "guidance_hi": (
            "इतना अधिक HbA1c स्तर पिछले महीनों में लगातार उच्च ब्लड शुगर को दर्शाता है। "
            "कृपया शीघ्र ही अपने डॉक्टर से परामर्श का समय लें।"
        ),
    },
]


def _extract_number(value_str: Any) -> Optional[float]:
    if value_str is None:
        return None
    if isinstance(value_str, (int, float)):
        return float(value_str)
    text = str(value_str).replace(",", "")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def _normalize_value_for_rule(rule_id: str, value: float, unit: str) -> Optional[float]:
    u = (unit or "").lower().strip()
    if rule_id == "hemoglobin":
        if "g/l" in u and "dl" not in u and value > 35:
            return value / 10.0
        return value
    if rule_id == "glucose":
        if "mmol" in u:
            return value * 18.018
        return value
    if rule_id == "platelets":
        if "lakh" in u:
            return value * 100.0  # 1.5 lakh -> 150 thousand
        if value > 2000:
            return value / 1000.0  # 150000 /uL -> 150 thousand
        return value
    if rule_id == "wbc":
        if value > 100:
            return value / 1000.0  # 7500 /cumm -> 7.5 thousand
        return value
    return value


def _match_rule(test_name: str) -> Optional[Dict[str, Any]]:
    name_low = (test_name or "").lower().strip()
    if not name_low:
        return None
    for rule in CRITICAL_RULES:
        for alias in rule["aliases"]:
            # Match whole word or substring for multi-word aliases
            if len(alias) <= 3:
                if re.search(rf"\b{re.escape(alias)}\b", name_low):
                    return rule
            elif alias in name_low:
                return rule
    return None


def _parse_range(normal_range: str) -> Tuple[Optional[float], Optional[float]]:
    if not normal_range:
        return None, None
    cleaned = normal_range.replace(",", "")
    # e.g., "12.0 - 15.5" or "70-100"
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)", cleaned, re.IGNORECASE)
    if m:
        return float(m.group(1)), float(m.group(2))
    # e.g., "< 200" or "<= 5.7"
    m_lt = re.search(r"<\s*=?\s*(\d+(?:\.\d+)?)", cleaned)
    if m_lt:
        return None, float(m_lt.group(1))
    # e.g., "> 40" or ">= 60"
    m_gt = re.search(r">\s*=?\s*(\d+(?:\.\d+)?)", cleaned)
    if m_gt:
        return float(m_gt.group(1)), None
    return None, None


def evaluate_clinical_alerts(tests: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Runs deterministic validation over extracted test rows:
    1. Verifies status against the report's numeric reference range when possible.
    2. Applies validated critical thresholds to produce 'urgent' alerts.
    3. Produces 'attention' alerts for routine out-of-range results.
    """
    alerts: List[Dict[str, Any]] = []
    validated_tests: List[Dict[str, Any]] = []

    for row in tests:
        item = dict(row)
        test_name = str(item.get("test_name", "")).strip()
        raw_result = str(item.get("result", "")).strip()
        unit = str(item.get("unit", "")).strip()
        normal_range = str(item.get("normal_range", "")).strip()
        status = str(item.get("status", "Normal")).strip().title()
        if status not in {"Normal", "Low", "High", "Borderline", "Unknown"}:
            status = "Unknown"

        num_val = _extract_number(raw_result)
        low_bound, high_bound = _parse_range(normal_range)

        # Deterministically cross-check status against report's reference range
        if num_val is not None and (low_bound is not None or high_bound is not None):
            if low_bound is not None and num_val < low_bound:
                status = "Low"
            elif high_bound is not None and num_val > high_bound:
                status = "High"
            else:
                status = "Normal"

        item["status"] = status
        severity = "normal"

        # Check deterministic critical/urgent clinical rules
        rule = _match_rule(test_name)
        is_urgent = False
        if rule and num_val is not None:
            norm_val = _normalize_value_for_rule(rule["id"], num_val, unit or raw_result)
            if norm_val is not None:
                c_low = rule["critical_low"]
                c_high = rule["critical_high"]
                if (c_low is not None and norm_val < c_low) or (
                    c_high is not None and norm_val > c_high
                ):
                    is_urgent = True
                    severity = "urgent"
                    alerts.append(
                        {
                            "test_name": test_name,
                            "value": f"{raw_result} {unit}".strip(),
                            "normal_range": normal_range or "See report",
                            "status": status,
                            "severity": "urgent",
                            "rule_id": rule["id"],
                            "title_en": f"Potentially Urgent Value: {test_name}",
                            "title_hi": f"तुरंत ध्यान देने योग्य मान: {test_name}",
                            "message_en": rule["guidance_en"],
                            "message_hi": rule["guidance_hi"],
                        }
                    )

        if not is_urgent and status in {"Low", "High"}:
            severity = "attention"
            direction_en = "below" if status == "Low" else "above"
            direction_hi = "कम" if status == "Low" else "अधिक"
            alerts.append(
                {
                    "test_name": test_name,
                    "value": f"{raw_result} {unit}".strip(),
                    "normal_range": normal_range or "See report",
                    "status": status,
                    "severity": "attention",
                    "rule_id": None,
                    "title_en": f"Out-of-Range ({status}): {test_name}",
                    "title_hi": f"सामान्य सीमा से बाहर ({direction_hi}): {test_name}",
                    "message_en": (
                        f"Your {test_name} result ({raw_result} {unit}) is {direction_en} the reference range "
                        f"({normal_range or 'listed on report'}). This is flagged as a routine out-of-range finding—"
                        "please review it with your doctor at your next visit."
                    ).replace("  ", " "),
                    "message_hi": (
                        f"आपका {test_name} परिणाम ({raw_result} {unit}) सामान्य सीमा ({normal_range or 'रिपोर्ट अनुसार'}) "
                        f"से {direction_hi} है। इसे सामान्य निगरानी (routine attention) के रूप में चिह्नित किया गया है—"
                        "कृपया अपनी अगली मुलाकात में डॉक्टर से इस पर चर्चा करें।"
                    ).replace("  ", " "),
                }
            )

        item["alert_severity"] = severity
        validated_tests.append(item)

    # Sort urgent alerts first
    alerts.sort(key=lambda a: 0 if a["severity"] == "urgent" else 1)

    return {
        "tests": validated_tests,
        "alerts": alerts,
        "urgent_count": sum(1 for a in alerts if a["severity"] == "urgent"),
        "attention_count": sum(1 for a in alerts if a["severity"] == "attention"),
    }

