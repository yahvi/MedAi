"""
Automated verification tests for MedAi Phase 1 backend.
Run from backend/: python -m unittest tests/test_phase1.py -v
"""

from __future__ import annotations

import io
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Ensure backend directory is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from config import Config
from services import storage as storage_mod
from services.clinical_rules import evaluate_clinical_alerts


class ClinicalRulesTests(unittest.TestCase):
    def test_urgent_vs_routine_classification(self):
        tests = [
            {"test_name": "Hemoglobin", "result": "6.5", "unit": "g/dL", "normal_range": "12.0 - 15.5", "status": "Low"},
            {"test_name": "Fasting Glucose", "result": "116", "unit": "mg/dL", "normal_range": "70 - 99", "status": "High"},
            {"test_name": "Serum Creatinine", "result": "0.9", "unit": "mg/dL", "normal_range": "0.6 - 1.2", "status": "Normal"},
            {"test_name": "Serum Potassium", "result": "6.3", "unit": "mEq/L", "normal_range": "3.5 - 5.1", "status": "High"},
        ]
        res = evaluate_clinical_alerts(tests)
        self.assertEqual(res["urgent_count"], 2)  # Hemoglobin + Potassium
        self.assertEqual(res["attention_count"], 1)  # Fasting Glucose
        severities = {t["test_name"]: t["alert_severity"] for t in res["tests"]}
        self.assertEqual(severities["Hemoglobin"], "urgent")
        self.assertEqual(severities["Serum Potassium"], "urgent")
        self.assertEqual(severities["Fasting Glucose"], "attention")
        self.assertEqual(severities["Serum Creatinine"], "normal")


class ApiEndToEndTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        Config.SQLITE_PATH = Path(self.tmp_dir.name) / "test_medai.db"
        Config.GEMINI_API_KEY = ""  # Force deterministic demo mode for offline CI tests
        storage_mod._storage_instance = None

        from app import create_app

        self.app = create_app()
        self.client = self.app.test_client()

    def tearDown(self):
        storage_mod._storage_instance = None
        self.tmp_dir.cleanup()

    def test_full_patient_flow(self):
        # 1. Health check
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["status"], "ok")

        # 2. Register & authenticate
        r = self.client.post(
            "/api/auth/register",
            json={"name": "Test Patient", "email": "test@medai.local", "password": "password123"},
        )
        self.assertEqual(r.status_code, 201)
        token = r.get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Update language & accessibility preferences
        r = self.client.put(
            "/api/auth/preferences",
            json={"language": "hi", "font_size": "large", "high_contrast": True},
            headers=headers,
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["preferences"]["language"], "hi")

        # 4. Upload a sample PDF file for analysis
        fake_pdf = (io.BytesIO(b"%PDF-1.4 fake medical report"), "lab_report.pdf")
        r = self.client.post(
            "/api/reports/analyze",
            data={"file": fake_pdf},
            content_type="multipart/form-data",
            headers=headers,
        )
        self.assertEqual(r.status_code, 201)
        report = r.get_json()["report"]
        self.assertGreater(len(report["analysis"]["tests"]), 0)
        self.assertEqual(report["urgent_count"], 0)
        self.assertGreater(report["attention_count"], 0)

        # 5. Create urgent demo sample and confirm deterministic clinical alert triggers
        r = self.client.post(
            "/api/reports/sample",
            json={"variant": "urgent_demo"},
            headers=headers,
        )
        self.assertEqual(r.status_code, 201)
        urgent_rep = r.get_json()["report"]
        self.assertEqual(urgent_rep["urgent_count"], 1)

        # 6. Start a Dr. Sehat chat attached to the report (Hindi & English)
        r = self.client.post(
            "/api/chat/sessions",
            json={"title": "Hemoglobin Check", "report_id": report["id"]},
            headers=headers,
        )
        self.assertEqual(r.status_code, 201)
        session_id = r.get_json()["session"]["id"]

        r = self.client.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"message": "Explain my Hemoglobin result", "language": "en"},
            headers=headers,
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("Hemoglobin", r.get_json()["assistant_message"]["content"])

        r = self.client.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"message": "मेरी रिपोर्ट का सारांश बताएं", "language": "hi"},
            headers=headers,
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(len(r.get_json()["assistant_message"]["content"]) > 20)

        # 7. Delete report & verify removal
        r = self.client.delete(f"/api/reports/{urgent_rep['id']}", headers=headers)
        self.assertEqual(r.status_code, 200)
        r = self.client.get(f"/api/reports/{urgent_rep['id']}", headers=headers)
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()

