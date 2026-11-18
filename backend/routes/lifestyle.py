from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from services.auth_service import require_auth
from services.modules_ai import (
    LIFESTYLE_MANDATORY_DISCLAIMER_EN,
    LIFESTYLE_MANDATORY_DISCLAIMER_HI,
    generate_lifestyle_plan,
)
from services.storage import get_storage

lifestyle_bp = Blueprint("lifestyle", __name__, url_prefix="/api/lifestyle")


@lifestyle_bp.get("")
@require_auth
def list_plans():
    store = get_storage()
    return jsonify(
        {
            "plans": store.list_lifestyle_plans(g.current_user["id"]),
            "mandatory_disclaimer_en": LIFESTYLE_MANDATORY_DISCLAIMER_EN,
            "mandatory_disclaimer_hi": LIFESTYLE_MANDATORY_DISCLAIMER_HI,
        }
    )


@lifestyle_bp.post("/generate")
@require_auth
def create_plan():
    body = request.get_json(silent=True) or {}
    profile = {
        "age": body.get("age", ""),
        "dietary_preference": body.get("dietary_preference", "Vegetarian"),
        "allergies": body.get("allergies", ""),
        "mobility_limitations": body.get("mobility_limitations", ""),
        "medical_restrictions": body.get("medical_restrictions", ""),
    }
    report_id = body.get("report_id") or None
    store = get_storage()
    uid = g.current_user["id"]
    report = store.get_report(uid, report_id) if report_id else None

    try:
        plan = generate_lifestyle_plan(profile, report)
    except Exception as exc:
        return jsonify({"error": f"Unable to generate lifestyle plan: {exc}"}), 500

    saved = store.save_lifestyle_plan(
        uid,
        {
            "report_id": report["id"] if report else None,
            "profile": profile,
            "plan": plan,
        },
    )
    return jsonify({"lifestyle_plan": saved}), 201


@lifestyle_bp.delete("/<plan_id>")
@require_auth
def delete_plan(plan_id: str):
    store = get_storage()
    if not store.delete_lifestyle_plan(g.current_user["id"], plan_id):
        return jsonify({"error": "Lifestyle plan not found."}), 404
    return jsonify({"deleted": True, "id": plan_id})

