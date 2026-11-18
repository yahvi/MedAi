from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from services.auth_service import require_auth
from services.gemini_service import chat_with_dr_sehat
from services.storage import get_storage

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")


@chat_bp.get("/sessions")
@require_auth
def list_sessions():
    store = get_storage()
    sessions = store.list_chat_sessions(g.current_user["id"])
    return jsonify({"sessions": sessions})


@chat_bp.post("/sessions")
@require_auth
def create_session():
    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "Chat with Dr. Sehat").strip()
    report_id = body.get("report_id") or None
    store = get_storage()
    if report_id and not store.get_report(g.current_user["id"], report_id):
        report_id = None
    session = store.create_chat_session(g.current_user["id"], title=title, report_id=report_id)
    return jsonify({"session": session}), 201


@chat_bp.get("/sessions/<session_id>")
@require_auth
def get_session(session_id: str):
    store = get_storage()
    session = store.get_chat_session(g.current_user["id"], session_id)
    if not session:
        return jsonify({"error": "Chat session not found."}), 404
    messages = store.list_chat_messages(g.current_user["id"], session_id)
    return jsonify({"session": session, "messages": messages})


@chat_bp.delete("/sessions/<session_id>")
@require_auth
def delete_session(session_id: str):
    store = get_storage()
    if not store.delete_chat_session(g.current_user["id"], session_id):
        return jsonify({"error": "Chat session not found."}), 404
    return jsonify({"deleted": True, "id": session_id})


@chat_bp.post("/sessions/<session_id>/messages")
@require_auth
def send_message(session_id: str):
    body = request.get_json(silent=True) or {}
    content = (body.get("message") or "").strip()
    language = body.get("language", "en")
    if language not in {"en", "hi"}:
        language = "en"
    report_id_override = body.get("report_id")

    if not content:
        return jsonify({"error": "Message cannot be empty."}), 400

    store = get_storage()
    user_id = g.current_user["id"]
    session = store.get_chat_session(user_id, session_id)
    if not session:
        return jsonify({"error": "Chat session not found."}), 404

    # Allow dynamically attaching/changing report context in an existing chat
    active_report_id = session.get("report_id")
    if report_id_override is not None:
        active_report_id = report_id_override or None
        store.update_chat_session(user_id, session_id, report_id=report_id_override)

    report = store.get_report(user_id, active_report_id) if active_report_id else None
    history = store.list_chat_messages(user_id, session_id)

    user_msg = store.add_chat_message(
        user_id=user_id,
        session_id=session_id,
        role="user",
        content=content,
        language=language,
    )

    try:
        result = chat_with_dr_sehat(
            message=content,
            language=language,
            report=report,
            previous_interaction_id=session.get("last_interaction_id"),
            recent_history=history,
        )
    except Exception as exc:
        return jsonify({"error": f"Dr. Sehat could not respond right now: {exc}"}), 500

    assistant_msg = store.add_chat_message(
        user_id=user_id,
        session_id=session_id,
        role="assistant",
        content=result["reply"],
        language=language,
    )

    # Update title on first user turn if still default
    new_title = None
    if len(history) == 0 and session.get("title") in {"Chat with Dr. Sehat", "New Conversation"}:
        new_title = content[:48] + ("..." if len(content) > 48 else "")

    store.update_chat_session(
        user_id=user_id,
        session_id=session_id,
        last_interaction_id=result.get("interaction_id"),
        title=new_title,
    )

    updated_session = store.get_chat_session(user_id, session_id)
    return jsonify(
        {
            "session": updated_session,
            "user_message": user_msg,
            "assistant_message": assistant_msg,
            "ai_mode": result.get("ai_mode", "demo"),
        }
    )

