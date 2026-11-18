"""
Authentication helper supporting Firebase Auth ID tokens (when Firebase Admin is active)
and signed local session tokens (PBKDF2 password hashing + HMAC-SHA256 bearer tokens).
"""

from __future__ import annotations

from functools import wraps
from typing import Any, Callable, Dict, Optional

from flask import g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from config import Config
from services import storage as storage_mod

TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7  # 7 days
_serializer = URLSafeTimedSerializer(Config.SECRET_KEY, salt="medai-auth-v1")


def hash_password(password: str) -> str:
    return generate_password_hash(password, method="pbkdf2:sha256")


def verify_password(password_hash: str, password: str) -> bool:
    if not password_hash:
        return False
    return check_password_hash(password_hash, password)


def issue_token(user: Dict[str, Any]) -> str:
    return _serializer.dumps({"uid": user["id"], "email": user["email"]})


def verify_bearer_token(token: str) -> Optional[Dict[str, Any]]:
    store = storage_mod.get_storage()

    # 1. Try Firebase ID token verification if Firebase Admin SDK is active
    if storage_mod.firebase_enabled:
        try:
            from firebase_admin import auth as fb_auth  # type: ignore

            decoded = fb_auth.verify_id_token(token)
            uid = decoded["uid"]
            email = decoded.get("email", "")
            name = decoded.get("name", "")
            return store.upsert_firebase_user(uid, email, name)
        except Exception:
            pass

    # 2. Verify local signed token
    try:
        payload = _serializer.loads(token, max_age=TOKEN_MAX_AGE_SECONDS)
        user = store.get_user_by_id(payload["uid"])
        return user
    except (BadSignature, SignatureExpired, KeyError):
        return None


def require_auth(fn: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required."}), 401
        token = auth_header.split(" ", 1)[1].strip()
        user = verify_bearer_token(token)
        if not user:
            return jsonify({"error": "Invalid or expired session token."}), 401
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "auth_provider": user.get("auth_provider", "local"),
        "created_at": user.get("created_at", ""),
    }

