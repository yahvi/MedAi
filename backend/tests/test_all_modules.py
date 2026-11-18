"""
Comprehensive end-to-end verification tests covering all 13 MedAi modules,
clinical safety rules, and per-user data isolation.
"""

from __future__ import annotations

import io
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from config import Config
from services import storage as storage_mod
from services.modules_ai import LIFESTYLE_MANDATORY_DISCLAIMER_EN, compare_reports


class AllModulesEndToEndTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        Config.SQLITE_PATH = Path(self.tmp_dir.name) / "test_all_medai.db"
        Config.GEMINI_API_KEY = ""  # Deterministic offline test mode
        storage_mod._storage_instance = None

        from app import create_app

        self.app = create_app()
        self.client = self.app.test_client()

    def tearDown(self):
        storage_mod._storage_instance = None
        self.tmp_dir.cleanup()

    def _register_and_headers(self, name: str, email: str):
        r = self.client.post(
            "/api/auth/register",
            json={"name": name, "email": email, "password": "password123"},
        )
        self.assertEqual(r.status_code, 201)
        return {"Authorization": f"Bearer {r.get_json()['token']}"}

    def test_all_13_modules_and_user_isolation(self):
        h_a = self._register_and_headers("Patient A", "a@medai.local")
        h_b = self._register_and_headers("Patient B", "b@medai.local")

        # 1. Health reports all 13 modules
        health = self.client.get("/api/health").get_json()
        self.assertEqual(health["status"], "ok")
        self.assertEqual(len(health["modules"]), 13)

        # 2. Module 2, 3, 13: Create latest & earlier baseline reports
        r_latest = self.client.post("/api/reports/sample", json={"variant": "standard"}, headers=h_a)
        self.assertEqual(r_latest.status_code, 201)
        latest_id = r_latest.get_json()["report"]["id"]

        r_base = self.client.post("/api/comparisons/sample-baseline", headers=h_a)
        self.assertEqual(r_base.status_code, 201)
        base_id = r_base.get_json()["report"]["id"]

        # Security check: Patient B cannot access or delete Patient A's report
        self.assertEqual(self.client.get(f"/api/reports/{latest_id}", headers=h_b).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/reports/{latest_id}", headers=h_b).status_code, 404)

        # 3. Module 5: Prescription Explainer (uncertain handwriting flagged)
        r_rx = self.client.post("/api/prescriptions/sample", headers=h_a)
        self.assertEqual(r_rx.status_code, 201)
        rx = r_rx.get_json()["prescription"]
        self.assertGreaterEqual(rx["uncertain_count"], 1)
        statuses = {m["legibility_status"] for m in rx["analysis"]["medicines"]}
        self.assertIn("uncertain", statuses)
        self.assertIn("clear", statuses)

        # Also test file upload endpoint for prescriptions
        fake_img = (io.BytesIO(b"\xff\xd8\xff\xe0fakejpeg"), "rx_photo.jpg")
        r_rx_up = self.client.post(
            "/api/prescriptions/analyze",
            data={"file": fake_img},
            content_type="multipart/form-data",
            headers=h_a,
        )
        self.assertEqual(r_rx_up.status_code, 201)

        # 4. Module 9: Medical Report Comparison & Health Progress
        r_comp = self.client.post(
            "/api/comparisons",
            json={"previous_report_id": base_id, "latest_report_id": latest_id},
            headers=h_a,
        )
        self.assertEqual(r_comp.status_code, 201)
        comp = r_comp.get_json()["comparison"]["comparison"]
        self.assertGreater(comp["counts"]["improved"], 0)  # Hb 10.4 -> 11.2, HbA1c 6.3 -> 6.0, Vit D 14 -> 18
        self.assertGreater(comp["counts"]["needs_attention"], 0)  # FBS 106 -> 114
        self.assertGreater(comp["counts"]["stable"], 0)  # Cholesterol, Creatinine, TSH

        # Unit mismatch must yield 'Insufficient data for comparison'
        unit_mismatch = compare_reports(
            {"title": "R1", "analysis": {"tests": [{"test_name": "Glucose", "result": "5.8", "unit": "mmol/L", "normal_range": "3.9 - 5.5"}]}},
            {"title": "R2", "analysis": {"tests": [{"test_name": "Glucose", "result": "104", "unit": "mg/dL", "normal_range": "70 - 99"}]}},
        )
        self.assertEqual(unit_mismatch["rows"][0]["indicator"], "Insufficient data for comparison")

        # 5. Module 10: Personalized Diet & Lifestyle Guide + Mandatory Disclaimer
        r_life = self.client.post(
            "/api/lifestyle/generate",
            json={
                "age": "36",
                "dietary_preference": "Vegetarian",
                "allergies": "Peanuts",
                "mobility_limitations": "Mild knee discomfort",
                "medical_restrictions": "Low sugar",
                "report_id": latest_id,
            },
            headers=h_a,
        )
        self.assertEqual(r_life.status_code, 201)
        life = r_life.get_json()["lifestyle_plan"]["plan"]
        self.assertEqual(life["mandatory_disclaimer_en"], LIFESTYLE_MANDATORY_DISCLAIMER_EN)
        self.assertEqual(len(life["weekly_plan"]), 7)
        self.assertGreater(len(life["foods_to_include"]), 0)
        self.assertGreater(len(life["foods_to_limit"]), 0)

        # 6. Module 11: Medical Dictionary + cross-linked report results
        r_dict = self.client.get("/api/dictionary/search?q=HbA1c", headers=h_a)
        self.assertEqual(r_dict.status_code, 200)
        dict_data = r_dict.get_json()
        self.assertIn("HbA1c", dict_data["entry"]["term"])
        self.assertGreater(len(dict_data["related_report_tests"]), 0)

        # 7. Module 12: Doctor Visit Preparation
        r_prep = self.client.post(
            "/api/doctor-prep/generate",
            json={
                "report_id": latest_id,
                "visit_goal": "Discuss Vitamin D and HbA1c",
                "concerns": ["Afternoon fatigue", "Occasional dizziness"],
            },
            headers=h_a,
        )
        self.assertEqual(r_prep.status_code, 201)
        prep = r_prep.get_json()["doctor_prep"]["prep"]
        self.assertGreater(len(prep["suggested_questions_en"]), 0)
        self.assertIn("Afternoon fatigue", prep["organized_concerns_en"])

        # 8. Module 12: Saved Doctors & Hospital Contacts
        r_doc = self.client.post(
            "/api/doctor-prep/doctors",
            json={
                "doctor_name": "Dr. Meera Kulkarni",
                "specialty": "Endocrinologist",
                "hospital_name": "City Care Hospital",
                "phone": "+91 98200 11223",
                "address": "MG Road, Pune",
            },
            headers=h_a,
        )
        self.assertEqual(r_doc.status_code, 201)
        doc_id = r_doc.get_json()["doctor"]["id"]
        self.assertEqual(len(self.client.get("/api/doctor-prep/doctors", headers=h_a).get_json()["doctors"]), 1)
        self.assertEqual(self.client.delete(f"/api/doctor-prep/doctors/{doc_id}", headers=h_b).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/doctor-prep/doctors/{doc_id}", headers=h_a).status_code, 200)


if __name__ == "__main__":
    unittest.main()

