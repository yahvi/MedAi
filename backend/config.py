import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=True)


class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "medai-dev-secret-key-change-in-prod")
    PORT = int(os.getenv("PORT", "5000"))
    CORS_ORIGINS_RAW = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).strip()
    CORS_ORIGINS = [o.strip().rstrip("/") for o in CORS_ORIGINS_RAW.split(",") if o.strip()]
    ALLOW_VERCEL_ORIGINS = os.getenv("ALLOW_VERCEL_ORIGINS", "true").lower() == "true"

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip() or "gemini-3.5-flash-lite"

    FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "").strip()
    FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "").strip()

    DATA_DIR = Path(os.getenv("MEDAI_DATA_DIR", str(BASE_DIR / "data")))
    UPLOAD_DIR = Path(os.getenv("MEDAI_UPLOAD_DIR", str(BASE_DIR / "uploads")))
    SQLITE_PATH = Path(os.getenv("SQLITE_PATH", str(DATA_DIR / "medai.db")))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload

    ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}
    ALLOWED_MIME_TYPES = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
    }

    MEDICAL_DISCLAIMER_EN = (
        "MedAi explains and organizes medical information for educational support only. "
        "It does NOT diagnose diseases, prescribe medicines, or replace professional medical advice. "
        "Always consult a qualified doctor before making any health or medication changes."
    )
    MEDICAL_DISCLAIMER_HI = (
        "MedAi केवल जानकारी और समझ को आसान बनाने के लिए है। यह किसी बीमारी का निदान (diagnosis) "
        "नहीं करता, दवाइयाँ नहीं लिखता और डॉक्टर की सलाह का विकल्प नहीं है। किसी भी स्वास्थ्य या दवाई "
        "में बदलाव से पहले हमेशा योग्य डॉक्टर से परामर्श करें।"
    )


Config.DATA_DIR.mkdir(parents=True, exist_ok=True)
Config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

