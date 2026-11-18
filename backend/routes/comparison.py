from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from services.auth_service import require_auth
from services.modules_ai import build_earlier_sample_report, compare_reports
from services.storage import get_storage

comparison_bp = Blueprint("comparison", __name__, url_prefix="/api/comparisons")


@comparison_bp.get("")
@require_auth
def list_comparisons():
    store = get_storage()
    return jsonify({"comparisons": store.list_comparisons(g.current_user["id"])})


@comparison_bp.delete("/<comparison_id>")
@require_auth
def delete_comparison(comparison_id: str):
    store = get_storage()
    if not store.delete_comparison(g.current_user["id"], comparison_id):
        return jsonify({"error": "Comparison not found."}), 404
    return jsonify({"deleted": True, "id": comparison_id})


@comparison_bp.post("")
@require_auth
def run_comparison():
    body = request.get_json(silent=True) or {}
    prev_id = body.get("previous_report_id")
    latest_id = body.get("latest_report_id")
    if not prev_id or not latest_id:
        return jsonify({"error": "Please select both a previous report and a latest report."}), 400
    if prev_id == latest_id:
        return jsonify({"error": "Please select two different reports to compare."}), 400

    store = get_storage()
    uid = g.current_user["id"]
    prev_rep = store.get_report(uid, prev_id)
    latest_rep = store.get_report(uid, latest_id)
    if not prev_rep or not latest_rep:
        return jsonify({"error": "One or both selected reports could not be found."}), 404

    result = compare_reports(prev_rep, latest_rep)
    saved = store.save_comparison(
        uid,
        {
            "previous_report_id": prev_id,
            "latest_report_id": latest_id,
            "previous_title": prev_rep["title"],
            "latest_title": latest_rep["title"],
            "comparison": result,
        },
    )
    return jsonify({"comparison": saved}), 201


@comparison_bp.post("/sample-baseline")
@require_auth
def create_sample_baseline():
    """Creates a realistic earlier baseline report so users can immediately test comparison."""
    store = get_storage()
    analysis = build_earlier_sample_report()
    saved = store.save_report(
        g.current_user["id"],
        {
            "title": analysis["report_title"],
            "file_name": "baseline_health_panel_3mo_ago.pdf",
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

