"""
auth_routes.py
Authentication endpoints: register, login, me, auto-send comparison report.
"""

import os
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.services.auth_service import (
    init_db,
    register_user,
    login_user,
    get_user_by_email,
    create_token,
    verify_token,
    send_comparison_report_to_user,
)

auth_router = APIRouter(prefix="/auth", tags=["auth"])

# Initialise DB on module load
init_db()


# ── Pydantic models ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:     str
    password:  str
    full_name: str
    company:   str = ""


class LoginRequest(BaseModel):
    email:    str
    password: str


class AutoReportRequest(BaseModel):
    subject:      str
    report_body:  str
    project_name: str = "Construction Project"


# ── Helpers ──────────────────────────────────────────────────────────────────────

def _get_current_user(authorization: str = "") -> dict:
    """Extract and verify Bearer token from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    token = authorization.split(" ", 1)[1]
    email = verify_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Token expired or invalid. Please log in again.")
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


# ── POST /auth/register ──────────────────────────────────────────────────────────

@auth_router.post("/register")
async def register(body: RegisterRequest):
    """
    Create a new engineer account.
    Returns JWT token + user profile on success.
    """
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if not body.full_name.strip():
        raise HTTPException(status_code=400, detail="Full name is required.")

    try:
        user  = register_user(body.email, body.password, body.full_name, body.company)
        token = create_token(user["email"])
        return {
            "success": True,
            "token":   token,
            "user": {
                "id":        user["id"],
                "email":     user["email"],
                "full_name": user["full_name"],
                "company":   user["company"],
                "role":      user["role"],
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {e}")


# ── POST /auth/login ─────────────────────────────────────────────────────────────

@auth_router.post("/login")
async def login(body: LoginRequest):
    """
    Authenticate an existing engineer.
    Returns JWT token + user profile on success.
    """
    user = login_user(body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = create_token(user["email"])
    return {
        "success": True,
        "token":   token,
        "user": {
            "id":        user["id"],
            "email":     user["email"],
            "full_name": user["full_name"],
            "company":   user["company"],
            "role":      user["role"],
        },
    }


# ── GET /auth/me ─────────────────────────────────────────────────────────────────

@auth_router.get("/me")
async def get_me(authorization: str = Header(default="")):
    """
    Return current user profile from token.
    Frontend calls this on page load to restore session.
    """
    user = _get_current_user(authorization)
    return {
        "id":        user["id"],
        "email":     user["email"],
        "full_name": user["full_name"],
        "company":   user["company"],
        "role":      user["role"],
    }


# ── POST /auth/send-comparison-report ────────────────────────────────────────────

@auth_router.post("/send-comparison-report")
async def send_comparison_report(
    body: AutoReportRequest,
    authorization: str = Header(default=""),
):
    """
    Automatically send the BOQ vs CAD comparison report to the logged-in engineer's email.
    No manual email entry needed — uses the account email directly.
    """
    user = _get_current_user(authorization)

    result = send_comparison_report_to_user(
        engineer_email=user["email"],
        engineer_name=user["full_name"],
        subject=body.subject,
        report_body=body.report_body,
    )

    if result.get("preview_mode"):
        return {
            **result,
            "sent_to":    user["email"],
            "message":    "SMTP not configured. Report generated but not sent.",
        }

    return {
        **result,
        "sent_to":    user["email"],
        "message":    f"Report automatically sent to {user['email']}",
    }
