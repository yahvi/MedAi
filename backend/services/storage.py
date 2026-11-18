"""
Unified Storage Layer for MedAi (All 13 Modules).

Uses Firebase Firestore + Firebase Storage when FIREBASE_CREDENTIALS_PATH is configured
and firebase-admin is installed; otherwise seamlessly uses local SQLite + local uploads/
with identical user-scoped data access guarantees.
"""

from __future__ import annotations

from contextlib import contextmanager
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from config import Config


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class StorageBackend:
    mode: str = "local"

    # Users & Preferences
    def create_user(self, email: str, name: str, password_hash: str) -> Dict[str, Any]:
        raise NotImplementedError

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def upsert_firebase_user(self, uid: str, email: str, name: str) -> Dict[str, Any]:
        raise NotImplementedError

    def get_preferences(self, user_id: str) -> Dict[str, Any]:
        raise NotImplementedError

    def update_preferences(self, user_id: str, prefs: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    # Medical Reports (Modules 2, 3, 8, 13)
    def save_report(self, user_id: str, report_data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def list_reports(self, user_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def get_report(self, user_id: str, report_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def delete_report(self, user_id: str, report_id: str) -> bool:
        raise NotImplementedError

    # Dr. Sehat Chat (Modules 4, 6, 7)
    def create_chat_session(
        self, user_id: str, title: str, report_id: Optional[str] = None
    ) -> Dict[str, Any]:
        raise NotImplementedError

    def list_chat_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def get_chat_session(self, user_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def update_chat_session(
        self,
        user_id: str,
        session_id: str,
        last_interaction_id: Optional[str] = None,
        title: Optional[str] = None,
        report_id: Optional[str] = None,
    ) -> None:
        raise NotImplementedError

    def delete_chat_session(self, user_id: str, session_id: str) -> bool:
        raise NotImplementedError

    def add_chat_message(
        self,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        language: str = "en",
    ) -> Dict[str, Any]:
        raise NotImplementedError

    def list_chat_messages(self, user_id: str, session_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    # Prescriptions (Module 5)
    def save_prescription(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def list_prescriptions(self, user_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def get_prescription(self, user_id: str, prescription_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def delete_prescription(self, user_id: str, prescription_id: str) -> bool:
        raise NotImplementedError

    # Report Comparisons (Module 9)
    def save_comparison(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def list_comparisons(self, user_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def delete_comparison(self, user_id: str, comparison_id: str) -> bool:
        raise NotImplementedError

    # Diet & Lifestyle Plans (Module 10)
    def save_lifestyle_plan(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def list_lifestyle_plans(self, user_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def delete_lifestyle_plan(self, user_id: str, plan_id: str) -> bool:
        raise NotImplementedError

    # Doctor Visit Preparations (Module 12)
    def save_doctor_prep(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def list_doctor_preps(self, user_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def delete_doctor_prep(self, user_id: str, prep_id: str) -> bool:
        raise NotImplementedError

    # Saved Doctors & Hospitals (Module 12)
    def save_doctor(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def list_doctors(self, user_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def delete_doctor(self, user_id: str, doctor_id: str) -> bool:
        raise NotImplementedError


class SQLiteStorage(StorageBackend):
    mode = "local-sqlite"

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    auth_provider TEXT NOT NULL DEFAULT 'local',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS user_preferences (
                    user_id TEXT PRIMARY KEY,
                    language TEXT NOT NULL DEFAULT 'en',
                    font_size TEXT NOT NULL DEFAULT 'normal',
                    high_contrast INTEGER NOT NULL DEFAULT 0,
                    voice_auto_read INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS medical_reports (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    report_date TEXT,
                    lab_name TEXT,
                    analysis_json TEXT NOT NULL,
                    urgent_count INTEGER NOT NULL DEFAULT 0,
                    attention_count INTEGER NOT NULL DEFAULT 0,
                    is_demo INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    report_id TEXT,
                    last_interaction_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    language TEXT NOT NULL DEFAULT 'en',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS prescriptions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    analysis_json TEXT NOT NULL,
                    uncertain_count INTEGER NOT NULL DEFAULT 0,
                    is_demo INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS report_comparisons (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    previous_report_id TEXT NOT NULL,
                    latest_report_id TEXT NOT NULL,
                    previous_title TEXT NOT NULL,
                    latest_title TEXT NOT NULL,
                    comparison_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS lifestyle_plans (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    report_id TEXT,
                    profile_json TEXT NOT NULL,
                    plan_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS doctor_preps (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    report_id TEXT,
                    report_title TEXT,
                    concerns_json TEXT NOT NULL,
                    prep_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS saved_doctors (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    doctor_name TEXT NOT NULL,
                    specialty TEXT NOT NULL,
                    hospital_name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    address TEXT NOT NULL,
                    notes TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
                """
            )

    # ---------- Users & Preferences ----------
    def create_user(self, email: str, name: str, password_hash: str) -> Dict[str, Any]:
        user_id = str(uuid.uuid4())
        now = _utc_now()
        email_norm = email.strip().lower()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO users (id, email, name, password_hash, auth_provider, created_at) VALUES (?, ?, ?, ?, 'local', ?)",
                (user_id, email_norm, name.strip(), password_hash, now),
            )
            conn.execute(
                "INSERT OR IGNORE INTO user_preferences (user_id, language, font_size, high_contrast, voice_auto_read, updated_at) VALUES (?, 'en', 'normal', 0, 0, ?)",
                (user_id, now),
            )
        return {"id": user_id, "email": email_norm, "name": name.strip(), "auth_provider": "local", "created_at": now}

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
            return dict(row) if row else None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return dict(row) if row else None

    def upsert_firebase_user(self, uid: str, email: str, name: str) -> Dict[str, Any]:
        now = _utc_now()
        email_norm = (email or f"{uid}@firebase.local").strip().lower()
        display = (name or email_norm.split("@")[0]).strip()
        with self._conn() as conn:
            existing = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO users (id, email, name, password_hash, auth_provider, created_at) VALUES (?, ?, ?, '', 'firebase', ?)",
                    (uid, email_norm, display, now),
                )
                conn.execute(
                    "INSERT OR IGNORE INTO user_preferences (user_id, language, font_size, high_contrast, voice_auto_read, updated_at) VALUES (?, 'en', 'normal', 0, 0, ?)",
                    (uid, now),
                )
        return self.get_user_by_id(uid) or {"id": uid, "email": email_norm, "name": display, "auth_provider": "firebase"}

    def get_preferences(self, user_id: str) -> Dict[str, Any]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)).fetchone()
            if not row:
                return {"language": "en", "font_size": "normal", "high_contrast": False, "voice_auto_read": False}
            return {
                "language": row["language"],
                "font_size": row["font_size"],
                "high_contrast": bool(row["high_contrast"]),
                "voice_auto_read": bool(row["voice_auto_read"]),
            }

    def update_preferences(self, user_id: str, prefs: Dict[str, Any]) -> Dict[str, Any]:
        current = self.get_preferences(user_id)
        lang = prefs.get("language", current["language"])
        if lang not in {"en", "hi", "hinglish"}:
            lang = "en"
        font_size = prefs.get("font_size", current["font_size"])
        if font_size not in {"normal", "large", "xlarge"}:
            font_size = "normal"
        high_contrast = 1 if prefs.get("high_contrast", current["high_contrast"]) else 0
        voice_auto_read = 1 if prefs.get("voice_auto_read", current["voice_auto_read"]) else 0
        now = _utc_now()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO user_preferences (user_id, language, font_size, high_contrast, voice_auto_read, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    language=excluded.language,
                    font_size=excluded.font_size,
                    high_contrast=excluded.high_contrast,
                    voice_auto_read=excluded.voice_auto_read,
                    updated_at=excluded.updated_at
                """,
                (user_id, lang, font_size, high_contrast, voice_auto_read, now),
            )
        return self.get_preferences(user_id)

    # ---------- Medical Reports ----------
    def save_report(self, user_id: str, report_data: Dict[str, Any]) -> Dict[str, Any]:
        report_id = str(uuid.uuid4())
        now = _utc_now()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO medical_reports
                    (id, user_id, title, file_name, file_type, report_date, lab_name,
                     analysis_json, urgent_count, attention_count, is_demo, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    report_id,
                    user_id,
                    report_data.get("title", "Medical Report"),
                    report_data.get("file_name", "report.pdf"),
                    report_data.get("file_type", "application/pdf"),
                    report_data.get("report_date", ""),
                    report_data.get("lab_name", ""),
                    json.dumps(report_data.get("analysis", {})),
                    int(report_data.get("urgent_count", 0)),
                    int(report_data.get("attention_count", 0)),
                    1 if report_data.get("is_demo", False) else 0,
                    now,
                ),
            )
        return self.get_report(user_id, report_id)  # type: ignore[return-value]

    def _hydrate_report(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "user_id": row["user_id"],
            "title": row["title"],
            "file_name": row["file_name"],
            "file_type": row["file_type"],
            "report_date": row["report_date"],
            "lab_name": row["lab_name"],
            "analysis": json.loads(row["analysis_json"]),
            "urgent_count": row["urgent_count"],
            "attention_count": row["attention_count"],
            "is_demo": bool(row["is_demo"]),
            "created_at": row["created_at"],
        }

    def list_reports(self, user_id: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM medical_reports WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
            return [self._hydrate_report(r) for r in rows]

    def get_report(self, user_id: str, report_id: str) -> Optional[Dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM medical_reports WHERE id = ? AND user_id = ?",
                (report_id, user_id),
            ).fetchone()
            return self._hydrate_report(row) if row else None

    def delete_report(self, user_id: str, report_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM medical_reports WHERE id = ? AND user_id = ?",
                (report_id, user_id),
            )
            return cur.rowcount > 0

    # ---------- Chat Sessions ----------
    def create_chat_session(
        self, user_id: str, title: str, report_id: Optional[str] = None
    ) -> Dict[str, Any]:
        session_id = str(uuid.uuid4())
        now = _utc_now()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO chat_sessions (id, user_id, title, report_id, last_interaction_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, NULL, ?, ?)
                """,
                (session_id, user_id, title.strip() or "Chat with Dr. Sehat", report_id, now, now),
            )
        return self.get_chat_session(user_id, session_id)  # type: ignore[return-value]

    def list_chat_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_chat_session(self, user_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?",
                (session_id, user_id),
            ).fetchone()
            return dict(row) if row else None

    def update_chat_session(
        self,
        user_id: str,
        session_id: str,
        last_interaction_id: Optional[str] = None,
        title: Optional[str] = None,
        report_id: Optional[str] = None,
    ) -> None:
        now = _utc_now()
        fields = ["updated_at = ?"]
        params: List[Any] = [now]
        if last_interaction_id is not None:
            fields.append("last_interaction_id = ?")
            params.append(last_interaction_id)
        if title is not None:
            fields.append("title = ?")
            params.append(title)
        if report_id is not None:
            fields.append("report_id = ?")
            params.append(report_id if report_id != "" else None)
        params.extend([session_id, user_id])
        with self._conn() as conn:
            conn.execute(
                f"UPDATE chat_sessions SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
                tuple(params),
            )

    def delete_chat_session(self, user_id: str, session_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM chat_sessions WHERE id = ? AND user_id = ?",
                (session_id, user_id),
            )
            return cur.rowcount > 0

    def add_chat_message(
        self,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        language: str = "en",
    ) -> Dict[str, Any]:
        msg_id = str(uuid.uuid4())
        now = _utc_now()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO chat_messages (id, session_id, user_id, role, content, language, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (msg_id, session_id, user_id, role, content, language, now),
            )
            conn.execute(
                "UPDATE chat_sessions SET updated_at = ? WHERE id = ? AND user_id = ?",
                (now, session_id, user_id),
            )
        return {
            "id": msg_id,
            "session_id": session_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "language": language,
            "created_at": now,
        }

    def list_chat_messages(self, user_id: str, session_id: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM chat_messages WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC",
                (session_id, user_id),
            ).fetchall()
            return [dict(r) for r in rows]

    # ---------- Prescriptions (Module 5) ----------
    def _hydrate_prescription(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "user_id": row["user_id"],
            "title": row["title"],
            "file_name": row["file_name"],
            "file_type": row["file_type"],
            "analysis": json.loads(row["analysis_json"]),
            "uncertain_count": row["uncertain_count"],
            "is_demo": bool(row["is_demo"]),
            "created_at": row["created_at"],
        }

    def save_prescription(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        pid = str(uuid.uuid4())
        now = _utc_now()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO prescriptions
                    (id, user_id, title, file_name, file_type, analysis_json, uncertain_count, is_demo, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pid,
                    user_id,
                    data.get("title", "Prescription"),
                    data.get("file_name", "prescription.jpg"),
                    data.get("file_type", "image/jpeg"),
                    json.dumps(data.get("analysis", {})),
                    int(data.get("uncertain_count", 0)),
                    1 if data.get("is_demo", False) else 0,
                    now,
                ),
            )
        return self.get_prescription(user_id, pid)  # type: ignore[return-value]

    def list_prescriptions(self, user_id: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM prescriptions WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
            return [self._hydrate_prescription(r) for r in rows]

    def get_prescription(self, user_id: str, prescription_id: str) -> Optional[Dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM prescriptions WHERE id = ? AND user_id = ?",
                (prescription_id, user_id),
            ).fetchone()
            return self._hydrate_prescription(row) if row else None

    def delete_prescription(self, user_id: str, prescription_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM prescriptions WHERE id = ? AND user_id = ?",
                (prescription_id, user_id),
            )
            return cur.rowcount > 0

    # ---------- Report Comparisons (Module 9) ----------
    def save_comparison(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        cid = str(uuid.uuid4())
        now = _utc_now()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO report_comparisons
                    (id, user_id, previous_report_id, latest_report_id, previous_title, latest_title, comparison_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    cid,
                    user_id,
                    data["previous_report_id"],
                    data["latest_report_id"],
                    data.get("previous_title", "Previous Report"),
                    data.get("latest_title", "Latest Report"),
                    json.dumps(data.get("comparison", {})),
                    now,
                ),
            )
        return {
            "id": cid,
            "user_id": user_id,
            "previous_report_id": data["previous_report_id"],
            "latest_report_id": data["latest_report_id"],
            "previous_title": data.get("previous_title", "Previous Report"),
            "latest_title": data.get("latest_title", "Latest Report"),
            "comparison": data.get("comparison", {}),
            "created_at": now,
        }

    def list_comparisons(self, user_id: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM report_comparisons WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
            return [
                {
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "previous_report_id": r["previous_report_id"],
                    "latest_report_id": r["latest_report_id"],
                    "previous_title": r["previous_title"],
                    "latest_title": r["latest_title"],
                    "comparison": json.loads(r["comparison_json"]),
                    "created_at": r["created_at"],
                }
                for r in rows
            ]

    def delete_comparison(self, user_id: str, comparison_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM report_comparisons WHERE id = ? AND user_id = ?",
                (comparison_id, user_id),
            )
            return cur.rowcount > 0

    # ---------- Lifestyle Plans (Module 10) ----------
    def save_lifestyle_plan(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        lid = str(uuid.uuid4())
        now = _utc_now()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO lifestyle_plans (id, user_id, report_id, profile_json, plan_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    lid,
                    user_id,
                    data.get("report_id"),
                    json.dumps(data.get("profile", {})),
                    json.dumps(data.get("plan", {})),
                    now,
                ),
            )
        return {
            "id": lid,
            "user_id": user_id,
            "report_id": data.get("report_id"),
            "profile": data.get("profile", {}),
            "plan": data.get("plan", {}),
            "created_at": now,
        }

    def list_lifestyle_plans(self, user_id: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM lifestyle_plans WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
            return [
                {
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "report_id": r["report_id"],
                    "profile": json.loads(r["profile_json"]),
                    "plan": json.loads(r["plan_json"]),
                    "created_at": r["created_at"],
                }
                for r in rows
            ]

    def delete_lifestyle_plan(self, user_id: str, plan_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM lifestyle_plans WHERE id = ? AND user_id = ?",
                (plan_id, user_id),
            )
            return cur.rowcount > 0

    # ---------- Doctor Visit Preps (Module 12) ----------
    def save_doctor_prep(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        dpid = str(uuid.uuid4())
        now = _utc_now()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO doctor_preps (id, user_id, report_id, report_title, concerns_json, prep_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    dpid,
                    user_id,
                    data.get("report_id"),
                    data.get("report_title", ""),
                    json.dumps(data.get("concerns", [])),
                    json.dumps(data.get("prep", {})),
                    now,
                ),
            )
        return {
            "id": dpid,
            "user_id": user_id,
            "report_id": data.get("report_id"),
            "report_title": data.get("report_title", ""),
            "concerns": data.get("concerns", []),
            "prep": data.get("prep", {}),
            "created_at": now,
        }

    def list_doctor_preps(self, user_id: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM doctor_preps WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
            return [
                {
                    "id": r["id"],
                    "user_id": r["user_id"],
                    "report_id": r["report_id"],
                    "report_title": r["report_title"],
                    "concerns": json.loads(r["concerns_json"]),
                    "prep": json.loads(r["prep_json"]),
                    "created_at": r["created_at"],
                }
                for r in rows
            ]

    def delete_doctor_prep(self, user_id: str, prep_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM doctor_preps WHERE id = ? AND user_id = ?",
                (prep_id, user_id),
            )
            return cur.rowcount > 0

    # ---------- Saved Doctors & Hospitals (Module 12) ----------
    def save_doctor(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        did = str(uuid.uuid4())
        now = _utc_now()
        doc = {
            "id": did,
            "user_id": user_id,
            "doctor_name": (data.get("doctor_name") or "").strip(),
            "specialty": (data.get("specialty") or "General Physician").strip(),
            "hospital_name": (data.get("hospital_name") or "").strip(),
            "phone": (data.get("phone") or "").strip(),
            "address": (data.get("address") or "").strip(),
            "notes": (data.get("notes") or "").strip(),
            "created_at": now,
        }
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO saved_doctors
                    (id, user_id, doctor_name, specialty, hospital_name, phone, address, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    doc["id"],
                    doc["user_id"],
                    doc["doctor_name"],
                    doc["specialty"],
                    doc["hospital_name"],
                    doc["phone"],
                    doc["address"],
                    doc["notes"],
                    doc["created_at"],
                ),
            )
        return doc

    def list_doctors(self, user_id: str) -> List[Dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM saved_doctors WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def delete_doctor(self, user_id: str, doctor_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM saved_doctors WHERE id = ? AND user_id = ?",
                (doctor_id, user_id),
            )
            return cur.rowcount > 0


class FirestoreStorage(StorageBackend):
    """Firestore backend used automatically when Firebase Admin SDK credentials are configured."""

    mode = "firebase-firestore"

    def __init__(self, db: Any):
        self.db = db

    def create_user(self, email: str, name: str, password_hash: str) -> Dict[str, Any]:
        user_id = str(uuid.uuid4())
        doc = {
            "id": user_id,
            "email": email.strip().lower(),
            "name": name.strip(),
            "password_hash": password_hash,
            "auth_provider": "local",
            "created_at": _utc_now(),
        }
        self.db.collection("users").document(user_id).set(doc)
        return doc

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        docs = self.db.collection("users").where("email", "==", email.strip().lower()).limit(1).stream()
        for d in docs:
            return d.to_dict()
        return None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        snap = self.db.collection("users").document(user_id).get()
        return snap.to_dict() if snap.exists else None

    def upsert_firebase_user(self, uid: str, email: str, name: str) -> Dict[str, Any]:
        ref = self.db.collection("users").document(uid)
        snap = ref.get()
        if snap.exists:
            return snap.to_dict()
        doc = {
            "id": uid,
            "email": (email or f"{uid}@firebase.local").lower(),
            "name": (name or "Patient").strip(),
            "password_hash": "",
            "auth_provider": "firebase",
            "created_at": _utc_now(),
        }
        ref.set(doc)
        return doc

    def get_preferences(self, user_id: str) -> Dict[str, Any]:
        snap = self.db.collection("user_preferences").document(user_id).get()
        if not snap.exists:
            return {"language": "en", "font_size": "normal", "high_contrast": False, "voice_auto_read": False}
        data = snap.to_dict()
        return {
            "language": data.get("language", "en"),
            "font_size": data.get("font_size", "normal"),
            "high_contrast": bool(data.get("high_contrast", False)),
            "voice_auto_read": bool(data.get("voice_auto_read", False)),
        }

    def update_preferences(self, user_id: str, prefs: Dict[str, Any]) -> Dict[str, Any]:
        merged = {**self.get_preferences(user_id), **prefs, "updated_at": _utc_now()}
        self.db.collection("user_preferences").document(user_id).set(merged, merge=True)
        return self.get_preferences(user_id)

    def _list_by_user(self, collection: str, user_id: str, sort_field: str = "created_at") -> List[Dict[str, Any]]:
        docs = self.db.collection(collection).where("user_id", "==", user_id).stream()
        items = [d.to_dict() for d in docs]
        items.sort(key=lambda x: x.get(sort_field, ""), reverse=True)
        return items

    def _get_owned(self, collection: str, doc_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        snap = self.db.collection(collection).document(doc_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict()
        return data if data.get("user_id") == user_id else None

    def _delete_owned(self, collection: str, doc_id: str, user_id: str) -> bool:
        if not self._get_owned(collection, doc_id, user_id):
            return False
        self.db.collection(collection).document(doc_id).delete()
        return True

    def save_report(self, user_id: str, report_data: Dict[str, Any]) -> Dict[str, Any]:
        rid = str(uuid.uuid4())
        doc = {"id": rid, "user_id": user_id, **report_data, "created_at": _utc_now()}
        self.db.collection("medical_reports").document(rid).set(doc)
        return doc

    def list_reports(self, user_id: str) -> List[Dict[str, Any]]:
        return self._list_by_user("medical_reports", user_id)

    def get_report(self, user_id: str, report_id: str) -> Optional[Dict[str, Any]]:
        return self._get_owned("medical_reports", report_id, user_id)

    def delete_report(self, user_id: str, report_id: str) -> bool:
        return self._delete_owned("medical_reports", report_id, user_id)

    def create_chat_session(self, user_id: str, title: str, report_id: Optional[str] = None) -> Dict[str, Any]:
        sid = str(uuid.uuid4())
        now = _utc_now()
        doc = {
            "id": sid,
            "user_id": user_id,
            "title": title.strip() or "Chat with Dr. Sehat",
            "report_id": report_id,
            "last_interaction_id": None,
            "created_at": now,
            "updated_at": now,
        }
        self.db.collection("chat_sessions").document(sid).set(doc)
        return doc

    def list_chat_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        return self._list_by_user("chat_sessions", user_id, sort_field="updated_at")

    def get_chat_session(self, user_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        return self._get_owned("chat_sessions", session_id, user_id)

    def update_chat_session(
        self,
        user_id: str,
        session_id: str,
        last_interaction_id: Optional[str] = None,
        title: Optional[str] = None,
        report_id: Optional[str] = None,
    ) -> None:
        if not self.get_chat_session(user_id, session_id):
            return
        updates: Dict[str, Any] = {"updated_at": _utc_now()}
        if last_interaction_id is not None:
            updates["last_interaction_id"] = last_interaction_id
        if title is not None:
            updates["title"] = title
        if report_id is not None:
            updates["report_id"] = report_id if report_id != "" else None
        self.db.collection("chat_sessions").document(session_id).update(updates)

    def delete_chat_session(self, user_id: str, session_id: str) -> bool:
        return self._delete_owned("chat_sessions", session_id, user_id)

    def add_chat_message(self, user_id: str, session_id: str, role: str, content: str, language: str = "en") -> Dict[str, Any]:
        mid = str(uuid.uuid4())
        now = _utc_now()
        doc = {"id": mid, "session_id": session_id, "user_id": user_id, "role": role, "content": content, "language": language, "created_at": now}
        self.db.collection("chat_sessions").document(session_id).collection("messages").document(mid).set(doc)
        self.db.collection("chat_sessions").document(session_id).update({"updated_at": now})
        return doc

    def list_chat_messages(self, user_id: str, session_id: str) -> List[Dict[str, Any]]:
        if not self.get_chat_session(user_id, session_id):
            return []
        docs = self.db.collection("chat_sessions").document(session_id).collection("messages").stream()
        items = [d.to_dict() for d in docs]
        items.sort(key=lambda x: x.get("created_at", ""))
        return items

    def save_prescription(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        pid = str(uuid.uuid4())
        doc = {"id": pid, "user_id": user_id, **data, "created_at": _utc_now()}
        self.db.collection("prescriptions").document(pid).set(doc)
        return doc

    def list_prescriptions(self, user_id: str) -> List[Dict[str, Any]]:
        return self._list_by_user("prescriptions", user_id)

    def get_prescription(self, user_id: str, prescription_id: str) -> Optional[Dict[str, Any]]:
        return self._get_owned("prescriptions", prescription_id, user_id)

    def delete_prescription(self, user_id: str, prescription_id: str) -> bool:
        return self._delete_owned("prescriptions", prescription_id, user_id)

    def save_comparison(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        cid = str(uuid.uuid4())
        doc = {"id": cid, "user_id": user_id, **data, "created_at": _utc_now()}
        self.db.collection("report_comparisons").document(cid).set(doc)
        return doc

    def list_comparisons(self, user_id: str) -> List[Dict[str, Any]]:
        return self._list_by_user("report_comparisons", user_id)

    def delete_comparison(self, user_id: str, comparison_id: str) -> bool:
        return self._delete_owned("report_comparisons", comparison_id, user_id)

    def save_lifestyle_plan(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        lid = str(uuid.uuid4())
        doc = {"id": lid, "user_id": user_id, **data, "created_at": _utc_now()}
        self.db.collection("lifestyle_plans").document(lid).set(doc)
        return doc

    def list_lifestyle_plans(self, user_id: str) -> List[Dict[str, Any]]:
        return self._list_by_user("lifestyle_plans", user_id)

    def delete_lifestyle_plan(self, user_id: str, plan_id: str) -> bool:
        return self._delete_owned("lifestyle_plans", plan_id, user_id)

    def save_doctor_prep(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        dpid = str(uuid.uuid4())
        doc = {"id": dpid, "user_id": user_id, **data, "created_at": _utc_now()}
        self.db.collection("doctor_preps").document(dpid).set(doc)
        return doc

    def list_doctor_preps(self, user_id: str) -> List[Dict[str, Any]]:
        return self._list_by_user("doctor_preps", user_id)

    def delete_doctor_prep(self, user_id: str, prep_id: str) -> bool:
        return self._delete_owned("doctor_preps", prep_id, user_id)

    def save_doctor(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        did = str(uuid.uuid4())
        doc = {"id": did, "user_id": user_id, **data, "created_at": _utc_now()}
        self.db.collection("saved_doctors").document(did).set(doc)
        return doc

    def list_doctors(self, user_id: str) -> List[Dict[str, Any]]:
        return self._list_by_user("saved_doctors", user_id)

    def delete_doctor(self, user_id: str, doctor_id: str) -> bool:
        return self._delete_owned("saved_doctors", doctor_id, user_id)


_storage_instance: Optional[StorageBackend] = None
firebase_enabled: bool = False


def get_storage() -> StorageBackend:
    global _storage_instance, firebase_enabled
    if _storage_instance is not None:
        return _storage_instance

    cred_path = Config.FIREBASE_CREDENTIALS_PATH
    if cred_path and Path(cred_path).exists():
        try:
            import firebase_admin  # type: ignore
            from firebase_admin import credentials, firestore  # type: ignore

            if not firebase_admin._apps:
                cred = credentials.Certificate(cred_path)
                opts = (
                    {"storageBucket": Config.FIREBASE_STORAGE_BUCKET}
                    if Config.FIREBASE_STORAGE_BUCKET
                    else None
                )
                firebase_admin.initialize_app(cred, opts)
            db = firestore.client()
            firebase_enabled = True
            _storage_instance = FirestoreStorage(db)
            return _storage_instance
        except Exception as exc:
            print(f"[MedAi] Firebase init failed ({exc}); falling back to local SQLite.")

    firebase_enabled = False
    _storage_instance = SQLiteStorage(Config.SQLITE_PATH)
    return _storage_instance
