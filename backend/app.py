from __future__ import annotations

import os
import re
from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from routes.auth import auth_bp
from routes.chat import chat_bp
from routes.comparison import comparison_bp
from routes.dictionary import dictionary_bp
from routes.doctor_prep import doctor_prep_bp
from routes.lifestyle import lifestyle_bp
from routes.prescriptions import prescriptions_bp
from routes.reports import reports_bp
from services import storage as storage_mod
from services.gemini_service import is_gemini_configured


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = Config.SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = Config.MAX_CONTENT_LENGTH

    if "*" in Config.CORS_ORIGINS:
        cors_origins = "*"
    else:
        cors_origins = list(Config.CORS_ORIGINS)
        if Config.ALLOW_VERCEL_ORIGINS:
            cors_origins.append(re.compile(r"^https://.*\.vercel\.app$"))

    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins}},
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    # Initialize storage backend on startup
    store = storage_mod.get_storage()

    # Register all 13 MedAi modules' REST API blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(prescriptions_bp)
    app.register_blueprint(comparison_bp)
    app.register_blueprint(lifestyle_bp)
    app.register_blueprint(dictionary_bp)
    app.register_blueprint(doctor_prep_bp)

    @app.get("/")
    def index():
        return jsonify(
            {
                "app": "MedAi API",
                "status": "running",
                "health_endpoint": "/api/health",
            }
        )

    @app.get("/api/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "app": "MedAi API",
                "phase": "Complete (All 13 Modules Active)",
                "storage_mode": store.mode,
                "firebase_enabled": storage_mod.firebase_enabled,
                "gemini_configured": is_gemini_configured(),
                "gemini_model": Config.GEMINI_MODEL,
                "supported_languages": ["en", "hi", "hinglish"],
                "planned_languages": ["mr", "gu"],
                "modules": [
                    "UI & Auth",
                    "AI Medical Report Analysis",
                    "Simplified Medical Report",
                    "Dr. Sehat Chatbot",
                    "Prescription Explainer",
                    "Multilingual EN/HI",
                    "Voice Assistance (STT/TTS)",
                    "Patient Dashboard & History",
                    "Report Comparison & Progress",
                    "Personalized Diet & Lifestyle Guide",
                    "Medical Dictionary",
                    "Doctor Visit Preparation",
                    "Important Health Alerts",
                ],
            }
        )

    @app.errorhandler(413)
    def too_large(_err):
        return jsonify({"error": "File is too large. Maximum allowed upload size is 16 MB."}), 413

    return app


app = create_app()

if __name__ == "__main__":
    print(f"[MedAi] Starting Flask API on http://127.0.0.1:{Config.PORT}")
    print(f"[MedAi] Storage mode: {storage_mod.get_storage().mode}")
    print(
        f"[MedAi] Gemini AI: {'LIVE (' + Config.GEMINI_MODEL + ')' if is_gemini_configured() else 'DEMO MODE (set GEMINI_API_KEY in backend/.env for live AI)'}"
    )
    debug_flag = os.getenv("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=Config.PORT, debug=debug_flag)
