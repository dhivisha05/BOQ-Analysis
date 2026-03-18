"""
db_service.py
Database service with dual-mode support:
  - PostgreSQL (serverless: Neon / Supabase / Railway) when DATABASE_URL is set
  - SQLite fallback for local development

Connection string from DATABASE_URL env var.
"""

import os
import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any
from contextlib import contextmanager

from loguru import logger

# ── Config ──────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "")
_USE_PG = bool(DATABASE_URL and "YOUR_" not in DATABASE_URL and DATABASE_URL.startswith("postgresql"))

_SQLITE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "flyyai.db")
_SQLITE_PATH = os.path.abspath(_SQLITE_PATH)

if _USE_PG:
    import psycopg2
    import psycopg2.extras
    logger.info("[DB] Mode: PostgreSQL (serverless)")
else:
    logger.info("[DB] Mode: SQLite (local) at {}", _SQLITE_PATH)


# ── Connection helpers ────────────────────────────────────────────────────────

def _get_pg_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


class _SqliteDict(sqlite3.Row):
    """Wrapper to make sqlite3.Row behave like a dict for compatibility."""
    pass


def _get_sqlite_conn():
    conn = sqlite3.connect(_SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    """Context manager — returns a connection (PG or SQLite)."""
    if _USE_PG:
        conn = _get_pg_conn()
    else:
        conn = _get_sqlite_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Table initialization ─────────────────────────────────────────────────────────

def init_tables():
    """Create all tables if they don't exist."""
    with get_db() as conn:
        cur = conn.cursor()

        if _USE_PG:
            # PostgreSQL DDL
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id          SERIAL PRIMARY KEY,
                    email       TEXT UNIQUE NOT NULL,
                    password    TEXT NOT NULL,
                    full_name   TEXT NOT NULL,
                    company     TEXT DEFAULT '',
                    role        TEXT DEFAULT 'engineer',
                    created_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS extractions (
                    id              SERIAL PRIMARY KEY,
                    user_id         INTEGER REFERENCES users(id),
                    filename        TEXT NOT NULL,
                    source          TEXT NOT NULL DEFAULT 'boq',
                    total_items     INTEGER DEFAULT 0,
                    total_sheets    INTEGER DEFAULT 0,
                    items_json      JSONB DEFAULT '[]'::jsonb,
                    categories_json JSONB DEFAULT '{}'::jsonb,
                    created_at      TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS comparisons (
                    id              SERIAL PRIMARY KEY,
                    user_id         INTEGER REFERENCES users(id),
                    boq_extraction  INTEGER REFERENCES extractions(id),
                    cad_extraction  INTEGER REFERENCES extractions(id),
                    match_score     REAL DEFAULT 0,
                    issues_count    INTEGER DEFAULT 0,
                    is_approved     BOOLEAN DEFAULT FALSE,
                    result_json     JSONB DEFAULT '{}'::jsonb,
                    created_at      TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS quote_requests (
                    id              SERIAL PRIMARY KEY,
                    user_id         INTEGER REFERENCES users(id),
                    extraction_id   INTEGER REFERENCES extractions(id),
                    vendor_emails   TEXT[] DEFAULT '{}',
                    materials_count INTEGER DEFAULT 0,
                    project_name    TEXT DEFAULT '',
                    email_sent      BOOLEAN DEFAULT FALSE,
                    created_at      TIMESTAMPTZ DEFAULT NOW()
                )
            """)
        else:
            # SQLite DDL
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    email       TEXT UNIQUE NOT NULL,
                    password    TEXT NOT NULL,
                    full_name   TEXT NOT NULL,
                    company     TEXT DEFAULT '',
                    role        TEXT DEFAULT 'engineer',
                    created_at  TEXT DEFAULT (datetime('now'))
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS extractions (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id         INTEGER REFERENCES users(id),
                    filename        TEXT NOT NULL,
                    source          TEXT NOT NULL DEFAULT 'boq',
                    total_items     INTEGER DEFAULT 0,
                    total_sheets    INTEGER DEFAULT 0,
                    items_json      TEXT DEFAULT '[]',
                    categories_json TEXT DEFAULT '{}',
                    created_at      TEXT DEFAULT (datetime('now'))
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS comparisons (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id         INTEGER REFERENCES users(id),
                    boq_extraction  INTEGER REFERENCES extractions(id),
                    cad_extraction  INTEGER REFERENCES extractions(id),
                    match_score     REAL DEFAULT 0,
                    issues_count    INTEGER DEFAULT 0,
                    is_approved     INTEGER DEFAULT 0,
                    result_json     TEXT DEFAULT '{}',
                    created_at      TEXT DEFAULT (datetime('now'))
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS quote_requests (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id         INTEGER REFERENCES users(id),
                    extraction_id   INTEGER REFERENCES extractions(id),
                    vendor_emails   TEXT DEFAULT '',
                    materials_count INTEGER DEFAULT 0,
                    project_name    TEXT DEFAULT '',
                    email_sent      INTEGER DEFAULT 0,
                    created_at      TEXT DEFAULT (datetime('now'))
                )
            """)

        conn.commit()
        logger.info("[DB] Tables initialized ({})", "PostgreSQL" if _USE_PG else "SQLite")


# ── Helper to normalize row to dict ──────────────────────────────────────────

def _row_to_dict(row) -> Optional[Dict]:
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    return dict(row)


# ── User CRUD ────────────────────────────────────────────────────────────────────

def db_create_user(email: str, password_hash: str, full_name: str, company: str = "") -> Dict:
    with get_db() as conn:
        cur = conn.cursor()
        if _USE_PG:
            cur.execute(
                """INSERT INTO users (email, password, full_name, company)
                   VALUES (%s, %s, %s, %s)
                   RETURNING id, email, full_name, company, role, created_at""",
                (email, password_hash, full_name, company),
            )
            return dict(cur.fetchone())
        else:
            cur.execute(
                """INSERT INTO users (email, password, full_name, company)
                   VALUES (?, ?, ?, ?)""",
                (email, password_hash, full_name, company),
            )
            user_id = cur.lastrowid
            conn.commit()
            cur.execute("SELECT id, email, full_name, company, role, created_at FROM users WHERE id = ?", (user_id,))
            return dict(cur.fetchone())


def db_get_user_by_email(email: str) -> Optional[Dict]:
    with get_db() as conn:
        cur = conn.cursor()
        if _USE_PG:
            cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        else:
            cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cur.fetchone()
        return _row_to_dict(row)


# ── Extraction CRUD ──────────────────────────────────────────────────────────────

def db_save_extraction(
    user_id: int,
    filename: str,
    source: str,
    total_items: int,
    total_sheets: int,
    items: List[Dict],
    categories: Dict,
) -> int:
    """Save an extraction result and return its ID."""
    items_str = json.dumps(items, default=str)
    cats_str  = json.dumps(categories, default=str)

    with get_db() as conn:
        cur = conn.cursor()
        if _USE_PG:
            cur.execute(
                """INSERT INTO extractions
                   (user_id, filename, source, total_items, total_sheets, items_json, categories_json)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (user_id, filename, source, total_items, total_sheets, items_str, cats_str),
            )
            return cur.fetchone()["id"]
        else:
            cur.execute(
                """INSERT INTO extractions
                   (user_id, filename, source, total_items, total_sheets, items_json, categories_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (user_id, filename, source, total_items, total_sheets, items_str, cats_str),
            )
            return cur.lastrowid


def db_get_user_extractions(user_id: int, limit: int = 20) -> List[Dict]:
    with get_db() as conn:
        cur = conn.cursor()
        if _USE_PG:
            cur.execute(
                """SELECT id, filename, source, total_items, total_sheets, created_at
                   FROM extractions WHERE user_id = %s
                   ORDER BY created_at DESC LIMIT %s""",
                (user_id, limit),
            )
        else:
            cur.execute(
                """SELECT id, filename, source, total_items, total_sheets, created_at
                   FROM extractions WHERE user_id = ?
                   ORDER BY created_at DESC LIMIT ?""",
                (user_id, limit),
            )
        return [dict(r) for r in cur.fetchall()]


# ── Comparison CRUD ──────────────────────────────────────────────────────────────

def db_save_comparison(
    user_id: int,
    boq_extraction_id: int,
    cad_extraction_id: int,
    match_score: float,
    issues_count: int,
    is_approved: bool,
    result: Dict,
) -> int:
    result_str = json.dumps(result, default=str)
    with get_db() as conn:
        cur = conn.cursor()
        if _USE_PG:
            cur.execute(
                """INSERT INTO comparisons
                   (user_id, boq_extraction, cad_extraction, match_score,
                    issues_count, is_approved, result_json)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (user_id, boq_extraction_id, cad_extraction_id,
                 match_score, issues_count, is_approved, result_str),
            )
            return cur.fetchone()["id"]
        else:
            cur.execute(
                """INSERT INTO comparisons
                   (user_id, boq_extraction, cad_extraction, match_score,
                    issues_count, is_approved, result_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (user_id, boq_extraction_id, cad_extraction_id,
                 match_score, issues_count, int(is_approved), result_str),
            )
            return cur.lastrowid


# ── Quote request CRUD ───────────────────────────────────────────────────────────

def db_save_quote_request(
    user_id: int,
    extraction_id: int,
    vendor_emails: List[str],
    materials_count: int,
    project_name: str,
    email_sent: bool,
) -> int:
    with get_db() as conn:
        cur = conn.cursor()
        if _USE_PG:
            cur.execute(
                """INSERT INTO quote_requests
                   (user_id, extraction_id, vendor_emails, materials_count,
                    project_name, email_sent)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (user_id, extraction_id, vendor_emails, materials_count, project_name, email_sent),
            )
            return cur.fetchone()["id"]
        else:
            emails_str = json.dumps(vendor_emails)
            cur.execute(
                """INSERT INTO quote_requests
                   (user_id, extraction_id, vendor_emails, materials_count,
                    project_name, email_sent)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (user_id, extraction_id, emails_str, materials_count, project_name, int(email_sent)),
            )
            return cur.lastrowid
