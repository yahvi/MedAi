from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from services.auth_service import require_auth
from services.modules_ai import CURATED_DICTIONARY, lookup_medical_term
from services.storage import get_storage

dictionary_bp = Blueprint("dictionary", __name__, url_prefix="/api/dictionary")


@dictionary_bp.get("/featured")
@require_auth
def featured_terms():
    return jsonify({"terms": CURATED_DICTIONARY})


@dictionary_bp.get("/search")
@require_auth
def search_term():
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"error": "Please enter a medical term or abbreviation to search."}), 400

    store = get_storage()
    reports = store.list_reports(g.current_user["id"])
    try:
        result = lookup_medical_term(q, reports)
    except Exception as exc:
        return jsonify({"error": f"Unable to look up term: {exc}"}), 500
    return jsonify(result)

