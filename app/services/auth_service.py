"""
auth_service.py
User registration, login, JWT tokens — backed by PostgreSQL.
Uses PBKDF2-SHA256 (stdlib) — no extra packages required.
"""

import os
import json
import hmac
import time
import base64
import hashlib
import smtplib
from typing import Optional, Dict
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from loguru import logger

from app.services.db_service import (
    init_tables,
    db_create_user,
    db_get_user_by_email,
)

# ── Config ──────────────────────────────────────────────────────────────────────
_JWT_SECRET       = os.getenv("JWT_SECRET", "flyyai-jwt-secret-change-in-production")
_JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "72"))
_PBKDF2_ITERS     = 260_000


# ── DB init ──────────────────────────────────────────────────────────────────────

def init_db() -> None:
    """Initialize database tables (PostgreSQL or SQLite)."""
    try:
        init_tables()
        logger.info("[Auth] Database tables ready")
    except Exception as e:
        logger.error(f"[Auth] DB init failed: {e}")
        # Don't crash the whole app — allow startup to continue


# ── Password hashing ─────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    key  = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERS)
    return salt.hex() + ":" + key.hex()


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, key_hex = stored.split(":")
        salt = bytes.fromhex(salt_hex)
        key  = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERS)
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


# ── JWT ──────────────────────────────────────────────────────────────────────────

def _b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (4 - len(s) % 4))


def create_token(email: str) -> str:
    header  = _b64e(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64e(json.dumps({
        "sub": email,
        "exp": int(time.time()) + _JWT_EXPIRE_HOURS * 3600,
    }).encode())
    sig = _b64e(hmac.new(
        _JWT_SECRET.encode(),
        f"{header}.{payload}".encode(),
        hashlib.sha256,
    ).digest())
    return f"{header}.{payload}.{sig}"


def verify_token(token: str) -> Optional[str]:
    try:
        h, p, s = token.split(".")
        expected = _b64e(hmac.new(
            _JWT_SECRET.encode(),
            f"{h}.{p}".encode(),
            hashlib.sha256,
        ).digest())
        if not hmac.compare_digest(expected, s):
            return None
        data = json.loads(_b64d(p))
        if data["exp"] < time.time():
            return None
        return data["sub"]
    except Exception:
        return None


# ── User CRUD ────────────────────────────────────────────────────────────────────

def register_user(email: str, password: str, full_name: str, company: str = "") -> Dict:
    email = email.lower().strip()
    existing = db_get_user_by_email(email)
    if existing:
        raise ValueError("Email already registered. Please log in.")
    pw_hash = _hash_password(password)
    user = db_create_user(email, pw_hash, full_name.strip(), company.strip())
    logger.info("[Auth] Registered: {}", email)
    return _safe_user(user)


def login_user(email: str, password: str) -> Optional[Dict]:
    email = email.lower().strip()
    row = db_get_user_by_email(email)
    if row and _verify_password(password, row["password"]):
        logger.info("[Auth] Login: {}", email)
        return _safe_user(row)
    return None


def get_user_by_email(email: str) -> Optional[Dict]:
    row = db_get_user_by_email(email.lower())
    return _safe_user(row) if row else None


def _safe_user(user: Dict) -> Dict:
    return {k: v for k, v in user.items() if k != "password"}


# ── Auto-send comparison report ─────────────────────────────────────────────────

def send_comparison_report_to_user(
    engineer_email: str,
    engineer_name: str,
    subject: str,
    report_body: str,
) -> Dict:
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    from_name = os.getenv("SMTP_FROM_NAME", "FlyyyAI Platform")

    if not (smtp_host and smtp_user and smtp_pass):
        logger.warning("[Auth] SMTP not configured")
        return {"success": False, "preview_mode": True, "email_body": report_body}

    try:
        html_body = _build_report_html(engineer_name, report_body)
        msg = MIMEMultipart("alternative")
        msg["From"]    = f"{from_name} <{smtp_user}>"
        msg["To"]      = engineer_email
        msg["Subject"] = subject
        msg.attach(MIMEText(report_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        logger.info("[Auth] Report auto-sent to {}", engineer_email)
        return {"success": True, "sent_to": engineer_email, "preview_mode": False}

    except Exception as e:
        logger.error("[Auth] Auto-send failed: {}", e)
        return {"success": False, "error": str(e), "preview_mode": False}


def _build_report_html(engineer_name: str, plain_body: str) -> str:
    from html import escape
    lines_html = "".join(
        f"<p style='margin:4px 0;font-size:13px;font-family:monospace;color:#1f2937;'>"
        f"{escape(line)}</p>"
        for line in plain_body.splitlines()
    )
    return f"""
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;background:#f8fafc;">
    <tr><td align="center">
      <table width="640" cellspacing="0" cellpadding="0"
             style="max-width:640px;background:#fff;border:1px solid #e5e7eb;
                    border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#111827;padding:18px 24px;">
            <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;
                        color:#f59e0b;font-weight:700;">FlyyyAI Construction Intelligence</div>
            <div style="font-size:18px;font-weight:700;color:#f9fafb;margin-top:6px;">
              BOQ vs CAD Comparison Report</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="font-size:14px;color:#374151;">Dear {escape(engineer_name)},</p>
            <p style="font-size:13px;color:#6b7280;">
              Issues detected between your BOQ and CAD drawings. Please review:</p>
            <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;
                        padding:16px;overflow-x:auto;">{lines_html}</div>
            <p style="font-size:12px;color:#9ca3af;margin:20px 0 0 0;">
              Automatically generated by FlyyyAI Platform.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
