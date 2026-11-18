from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from werkzeug.utils import secure_filename

from config import Config
from services.auth_service import require_auth
from services.gemini_service import analyze_medical_report, _build_demo_report_analysis
from services.storage import get_storage

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


def _allowed_ext(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


@reports_bp.get("")
@require_auth
def list_reports():
    store = get_storage()
    reports = store.list_reports(g.current_user["id"])
    return jsonify({"reports": reports})


@reports_bp.get("/<report_id>")
@require_auth
def get_report(report_id: str):
    store = get_storage()
    report = store.get_report(g.current_user["id"], report_id)
    if not report:
        return jsonify({"error": "Report not found."}), 404
    return jsonify({"report": report})


@reports_bp.delete("/<report_id>")
@require_auth
def delete_report(report_id: str):
    store = get_storage()
    deleted = store.delete_report(g.current_user["id"], report_id)
    if not deleted:
        return jsonify({"error": "Report not found."}), 404
    return jsonify({"deleted": True, "id": report_id})


@reports_bp.post("/analyze")
@require_auth
def upload_and_analyze():
    if "file" not in request.files:
        return jsonify({"error": "Please attach a medical report file (PDF, JPG, or PNG)."}), 400

    uploaded = request.files["file"]
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "No file selected."}), 400

    safe_name = secure_filename(uploaded.filename)
    ext = _allowed_ext(safe_name)
    if ext not in Config.ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unsupported file type. Please upload a PDF, JPG, or PNG file."}), 400

    file_bytes = uploaded.read()
    if not file_bytes:
        return jsonify({"error": "Uploaded file is empty."}), 400

    mime_type = Config.ALLOWED_MIME_TYPES[ext]

    try:
        analysis = analyze_medical_report(
            file_bytes=file_bytes,
            mime_type=mime_type,
            file_name=safe_name,
        )
    except Exception as exc:
        return jsonify({"error": f"Unable to analyze report right now: {exc}"}), 500

    store = get_storage()
    saved = store.save_report(
        user_id=g.current_user["id"],
        report_data={
            "title": analysis.get("report_title") or safe_name,
            "file_name": safe_name,
            "file_type": mime_type,
            "report_date": analysis.get("report_date", ""),
            "lab_name": analysis.get("lab_name", ""),
            "analysis": analysis,
            "urgent_count": analysis.get("urgent_count", 0),
            "attention_count": analysis.get("attention_count", 0),
            "is_demo": analysis.get("ai_mode") == "demo",
        },
    )
    return jsonify({"report": saved}), 201


@reports_bp.post("/sample")
@require_auth
def create_sample_report():
    """Creates an instant sample report so users can explore the UI and clinical alerts without uploading a file."""
    body = request.get_json(silent=True) or {}
    variant = body.get("variant", "standard")
    if variant not in {"standard", "urgent_demo"}:
        variant = "standard"

    file_name = (
        "sample_urgent_cbc_panel.pdf" if variant == "urgent_demo" else "sample_health_panel.pdf"
    )
    analysis = _build_demo_report_analysis(file_name=file_name, variant=variant)

    store = get_storage()
    saved = store.save_report(
        user_id=g.current_user["id"],
        report_data={
            "title": analysis["report_title"],
            "file_name": file_name,
            "file_type": "application/pdf",
            "report_date": analysis["report_date"],
            "lab_name": analysis["lab_name"],
            "analysis": analysis,
            "urgent_count": analysis["urgent_count"],
            "attention_count": analysis["attention_count"],
            "is_demo": True,
        },
    )
    return jsonify({"report": saved}), 201

