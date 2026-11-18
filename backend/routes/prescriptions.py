from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from werkzeug.utils import secure_filename

from config import Config
from services.auth_service import require_auth
from services.modules_ai import analyze_prescription, build_demo_prescription
from services.storage import get_storage

prescriptions_bp = Blueprint("prescriptions", __name__, url_prefix="/api/prescriptions")


def _allowed_ext(filename: str) -> str:
    return filename.rsplit(".", 1)[1].lower() if "." in filename else ""


@prescriptions_bp.get("")
@require_auth
def list_prescriptions():
    store = get_storage()
    return jsonify({"prescriptions": store.list_prescriptions(g.current_user["id"])})


@prescriptions_bp.delete("/<prescription_id>")
@require_auth
def delete_prescription(prescription_id: str):
    store = get_storage()
    if not store.delete_prescription(g.current_user["id"], prescription_id):
        return jsonify({"error": "Prescription not found."}), 404
    return jsonify({"deleted": True, "id": prescription_id})


@prescriptions_bp.post("/analyze")
@require_auth
def upload_and_explain():
    if "file" not in request.files:
        return jsonify({"error": "Please upload a prescription image or PDF (JPG, PNG, PDF)."}), 400
    uploaded = request.files["file"]
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "No file selected."}), 400

    safe_name = secure_filename(uploaded.filename)
    ext = _allowed_ext(safe_name)
    if ext not in Config.ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unsupported file type. Use JPG, PNG, or PDF."}), 400

    file_bytes = uploaded.read()
    if not file_bytes:
        return jsonify({"error": "Uploaded file is empty."}), 400

    mime_type = Config.ALLOWED_MIME_TYPES[ext]
    try:
        analysis = analyze_prescription(file_bytes, mime_type, safe_name)
    except Exception as exc:
        return jsonify({"error": f"Unable to explain prescription: {exc}"}), 500

    store = get_storage()
    saved = store.save_prescription(
        g.current_user["id"],
        {
            "title": analysis.get("title") or safe_name,
            "file_name": safe_name,
            "file_type": mime_type,
            "analysis": analysis,
            "uncertain_count": analysis.get("uncertain_count", 0),
            "is_demo": analysis.get("ai_mode") == "demo",
        },
    )
    return jsonify({"prescription": saved}), 201


@prescriptions_bp.post("/sample")
@require_auth
def create_sample_prescription():
    analysis = build_demo_prescription("sample_outpatient_rx.jpg")
    store = get_storage()
    saved = store.save_prescription(
        g.current_user["id"],
        {
            "title": analysis["title"],
            "file_name": "sample_outpatient_rx.jpg",
            "file_type": "image/jpeg",
            "analysis": analysis,
            "uncertain_count": analysis["uncertain_count"],
            "is_demo": True,
        },
    )
    return jsonify({"prescription": saved}), 201

