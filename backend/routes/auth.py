from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from services.auth_service import (
    hash_password,
    issue_token,
    public_user,
    require_auth,
    verify_password,
)
from services.storage import get_storage

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

DEMO_EMAIL = "demo@medai.local"
DEMO_PASSWORD = "demo-patient-password"
DEMO_NAME = "Aarav Sharma (Demo Patient)"


@auth_bp.post("/register")
def register():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not name or not email or len(password) < 6:
        return jsonify({"error": "Please provide your name, email, and a password of at least 6 characters."}), 400

    store = get_storage()
    if store.get_user_by_email(email):
        return jsonify({"error": "An account with this email already exists."}), 409

    user = store.create_user(email=email, name=name, password_hash=hash_password(password))
    token = issue_token(user)
    prefs = store.get_preferences(user["id"])
    return jsonify({"token": token, "user": public_user(user), "preferences": prefs}), 201


@auth_bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    store = get_storage()
    user = store.get_user_by_email(email)
    if not user or not verify_password(user.get("password_hash", ""), password):
        return jsonify({"error": "Invalid email or password."}), 401

    token = issue_token(user)
    prefs = store.get_preferences(user["id"])
    return jsonify({"token": token, "user": public_user(user), "preferences": prefs})


@auth_bp.post("/demo")
def demo_login():
    """Creates or logs into a local demo patient account for immediate testing."""
    store = get_storage()
    user = store.get_user_by_email(DEMO_EMAIL)
    if not user:
        user = store.create_user(
            email=DEMO_EMAIL,
            name=DEMO_NAME,
            password_hash=hash_password(DEMO_PASSWORD),
        )
    token = issue_token(user)
    prefs = store.get_preferences(user["id"])
    return jsonify({"token": token, "user": public_user(user), "preferences": prefs})


@auth_bp.get("/me")
@require_auth
def me():
    store = get_storage()
    prefs = store.get_preferences(g.current_user["id"])
    return jsonify({"user": public_user(g.current_user), "preferences": prefs})


@auth_bp.put("/preferences")
@require_auth
def update_preferences():
    body = request.get_json(silent=True) or {}
    store = get_storage()
    prefs = store.update_preferences(g.current_user["id"], body)
    return jsonify({"preferences": prefs})

