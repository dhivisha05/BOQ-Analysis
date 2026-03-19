"""
supabase_auth.py
Supabase JWT verification for FastAPI backend.
Verifies tokens issued by Supabase Auth using the JWT secret.
"""

import os
import json
import hmac
import time
import base64
import hashlib
from typing import Optional, Dict

from loguru import logger

# ── Config ──────────────────────────────────────────────────────────────────────
# Supabase JWT secret — found in Supabase Dashboard > Settings > API > JWT Secret
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_URL        = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY   = os.getenv("SUPABASE_ANON_KEY", "")

# Fallback to old JWT secret for backward compatibility
_JWT_SECRET_RAW = SUPABASE_JWT_SECRET or os.getenv("JWT_SECRET", "flyyai-jwt-secret-change-in-production")

# Supabase uses the raw secret string as HMAC key (UTF-8 encoded)
_JWT_SECRET_BYTES = _JWT_SECRET_RAW.encode("utf-8")

# Also keep base64-decoded version as fallback
try:
    _JWT_SECRET_BYTES_B64 = base64.b64decode(_JWT_SECRET_RAW)
except Exception:
    _JWT_SECRET_BYTES_B64 = None


# ── Base64 helpers ──────────────────────────────────────────────────────────────

def _b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (4 - len(s) % 4))


# ── JWT verification ───────────────────────────────────────────────────────────

def verify_supabase_token(token: str) -> Optional[Dict]:
    """
    Verify a Supabase-issued JWT token.
    Returns the decoded payload dict on success, None on failure.
    Payload includes: sub (user UUID), email, role, exp, etc.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        h, p, s = parts
        msg = f"{h}.{p}".encode()

        # Try raw UTF-8 secret first, then base64-decoded
        verified = False
        for secret_bytes in [_JWT_SECRET_BYTES, _JWT_SECRET_BYTES_B64]:
            if secret_bytes is None:
                continue
            expected_sig = _b64e(hmac.new(
                secret_bytes, msg, hashlib.sha256,
            ).digest())
            if hmac.compare_digest(expected_sig, s):
                verified = True
                break

        if not verified:
            logger.debug("[SupaAuth] Signature mismatch (tried both raw and b64 secrets)")
            return None

        # Decode payload
        payload = json.loads(_b64d(p))

        # Check expiration
        if payload.get("exp", 0) < time.time():
            logger.debug("[SupaAuth] Token expired")
            return None

        return payload

    except Exception as e:
        logger.debug("[SupaAuth] Token verification failed: {}", str(e)[:80])
        return None


def get_user_from_token(token: str) -> Optional[Dict]:
    """
    Extract user info from a verified Supabase JWT.
    Returns dict with: id, email, role, user_metadata.
    """
    payload = verify_supabase_token(token)
    if not payload:
        return None

    return {
        "id":            payload.get("sub", ""),
        "email":         payload.get("email", ""),
        "role":          payload.get("role", "authenticated"),
        "user_metadata": payload.get("user_metadata", {}),
    }


def extract_bearer_token(authorization: str) -> Optional[str]:
    """Extract token from 'Bearer xxx' header value."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization.split(" ", 1)[1].strip()
