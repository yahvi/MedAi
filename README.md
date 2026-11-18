# MedAi — AI-Powered Medical Communication Assistant

MedAi is a complete full-stack AI medical communication platform built with **React + Vite + Tailwind CSS** (`frontend/`) and **Python Flask + Gemini 3.8 Flash (`google-genai` Interactions API)** (`backend/`), backed by **Firebase Firestore / Auth** (with automatic zero-setup local SQLite + signed auth fallback and interactive Demo Mode).

> **Medical Disclaimer:** MedAi explains and organizes medical information for educational support only. It does **not** diagnose diseases, prescribe medicines, or replace professional medical advice.

## All 13 Implemented Modules

1. **Module 1 — UI, Auth & Accessibility:** Responsive desktop/mobile dashboard, Login/Register/Demo Patient auth, font scaling (Normal / Large / Extra Large), High Contrast mode.
2. **Module 2 — AI Medical Report Analysis:** PDF/JPG/PNG upload via Gemini 3.8 Flash multimodal extraction into a structured `Test Name | Result | Normal Range | Status` table.
3. **Module 3 — Simplified Medical Report:** Plain-language EN & HI explanations, complex terms glossary, Listen Aloud TTS, and downloadable summary.
4. **Module 4 — Dr. Sehat AI Medical Chatbot:** Report-aware stateful multi-turn conversational assistant with strict safety guardrails.
5. **Module 5 — Prescription Explainer:** Multimodal prescription reader decoding abbreviations (`OD`, `BD`, `TDS`, `HS`, `PC`, `SOS`) while explicitly highlighting unclear handwriting and prompting doctor/pharmacist confirmation instead of guessing.
6. **Module 6 — Multilingual Support:** Full English & Hindi (`हिन्दी`) UI and AI outputs, architected for regional Indian languages (Marathi, Gujarati).
7. **Module 7 — Voice Assistance:** Speech-to-Text microphone input & Text-to-Speech read-aloud (`en-IN` & `hi-IN`).
8. **Module 8 — Patient Dashboard & History:** User-scoped chronological history of medical reports, prescriptions, and Dr. Sehat chats with view/delete controls.
9. **Module 9 — Medical Report Comparison & Health Progress:** Matches comparable tests/units across two reports and evaluates changes relative to reference ranges (`Improved relative to the reference range`, `Stable`, `Needs attention`, `Insufficient data for comparison`).
10. **Module 10 — Personalized Diet & Lifestyle Guide:** Two dedicated sections (**Section A: Daily Diet & Lifestyle Guidance** and **Section B: 7-Day Weekly Diet & Exercise Plan**) plus the mandatory medication safety disclaimer.
11. **Module 11 — Medical Dictionary:** Searchable EN/HI terminology & abbreviation lookup cross-linked to matching tests in the patient's own uploaded reports.
12. **Module 12 — Doctor Visit Preparation:** Organizes report topics, personal concerns, prioritized doctor questions, and a copyable/downloadable pre-visit checklist.
13. **Module 13 — Important Health Alerts:** Deterministic validated clinical rules engine separating **Potentially Urgent** values from **Routine Out-of-Range** findings independently of unrestricted AI.

## Quick Start

### 1. Backend (Flask)
```powershell
cd backend
copy .env.example .env   # Optional: add GEMINI_API_KEY for live Gemini 3.8 Flash
.\.venv\Scripts\python.exe app.py
```
API runs on `http://127.0.0.1:5000`.

### 2. Frontend (React + Vite)
```powershell
cd frontend
npm run dev
```
App runs on `http://localhost:5173`.

## Security & Firebase
- Production-oriented Firestore security rules are included in [firestore.rules](firestore.rules) enforcing strict per-user isolation across all collections.
- Run automated backend tests: `.\backend\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v`
