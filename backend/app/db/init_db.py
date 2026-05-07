"""Database initialization and seeding.

The backend lazily initializes the SQLite database on first request.  Calling
:func:`init_db` is idempotent — tables are created with ``IF NOT EXISTS`` and
seed rows are inserted with ``INSERT OR IGNORE``.
"""

from __future__ import annotations

import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.db.schema import INDEX_STATEMENTS, SCHEMA_STATEMENTS

DEFAULT_USER_ID = "default"
DEFAULT_CASH_BALANCE = 10000.0
DEFAULT_WATCHLIST: tuple[str, ...] = (
    "AAPL",
    "GOOGL",
    "MSFT",
    "AMZN",
    "TSLA",
    "NVDA",
    "META",
    "JPM",
    "V",
    "NFLX",
)


def get_default_db_path() -> str:
    """Return the SQLite database path from ``DB_PATH`` env or sensible default.

    Falls back to ``/app/db/finally.db`` when running in a container layout
    (i.e. ``/app/db`` exists), otherwise ``db/finally.db`` relative to cwd.
    """
    env_path = os.environ.get("DB_PATH")
    if env_path:
        return env_path
    container_dir = Path("/app/db")
    if container_dir.is_dir():
        return str(container_dir / "finally.db")
    return str(Path("db") / "finally.db")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _create_schema(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()
    for statement in SCHEMA_STATEMENTS:
        cursor.execute(statement)
    for statement in INDEX_STATEMENTS:
        cursor.execute(statement)


def _seed_default_user(conn: sqlite3.Connection) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
        (DEFAULT_USER_ID, DEFAULT_CASH_BALANCE, _now_iso()),
    )


def _seed_default_watchlist(conn: sqlite3.Connection) -> None:
    now = _now_iso()
    rows = [(str(uuid.uuid4()), DEFAULT_USER_ID, ticker, now) for ticker in DEFAULT_WATCHLIST]
    conn.executemany(
        "INSERT OR IGNORE INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
        rows,
    )


def init_db(db_path: str) -> None:
    """Create the schema and seed default data at ``db_path``.

    Safe to call repeatedly. ``db_path`` may be ``":memory:"`` for tests, or
    any filesystem path (parent directories will be created).
    """
    if db_path != ":memory:":
        parent = Path(db_path).parent
        if str(parent) and not parent.exists():
            parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        _create_schema(conn)
        _seed_default_user(conn)
        _seed_default_watchlist(conn)
        conn.commit()
    finally:
        conn.close()
