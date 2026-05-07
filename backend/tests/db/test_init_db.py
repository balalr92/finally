"""Tests for database initialization and seeding."""

from __future__ import annotations

import sqlite3

import pytest

from app.db.init_db import (
    DEFAULT_CASH_BALANCE,
    DEFAULT_USER_ID,
    DEFAULT_WATCHLIST,
    init_db,
)
from app.db.schema import TABLE_NAMES


def _connect_initialized() -> sqlite3.Connection:
    """Init a fresh in-memory db and return an open connection sharing it.

    SQLite ``:memory:`` databases are unique per connection, so we initialize
    against a connection-shared URI.
    """
    # Use a file: URI with shared cache so init_db and the test see same DB.
    # Simpler: just reopen and re-init — init is idempotent and cheap.
    return sqlite3.connect(":memory:")


def test_init_db_creates_all_tables(tmp_path):
    db_path = str(tmp_path / "finally.db")
    init_db(db_path)

    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        names = {row[0] for row in rows}
    finally:
        conn.close()

    for table in TABLE_NAMES:
        assert table in names, f"missing table: {table}"


def test_init_db_seeds_default_user(tmp_path):
    db_path = str(tmp_path / "finally.db")
    init_db(db_path)

    conn = sqlite3.connect(db_path)
    try:
        row = conn.execute(
            "SELECT id, cash_balance FROM users_profile WHERE id = ?",
            (DEFAULT_USER_ID,),
        ).fetchone()
    finally:
        conn.close()

    assert row is not None
    assert row[0] == DEFAULT_USER_ID
    assert row[1] == pytest.approx(DEFAULT_CASH_BALANCE)


def test_init_db_seeds_default_watchlist(tmp_path):
    db_path = str(tmp_path / "finally.db")
    init_db(db_path)

    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY ticker",
            (DEFAULT_USER_ID,),
        ).fetchall()
    finally:
        conn.close()

    tickers = {row[0] for row in rows}
    assert tickers == set(DEFAULT_WATCHLIST)


def test_init_db_is_idempotent(tmp_path):
    db_path = str(tmp_path / "finally.db")
    init_db(db_path)
    init_db(db_path)
    init_db(db_path)

    conn = sqlite3.connect(db_path)
    try:
        user_count = conn.execute(
            "SELECT COUNT(*) FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
        ).fetchone()[0]
        watchlist_count = conn.execute(
            "SELECT COUNT(*) FROM watchlist WHERE user_id = ?", (DEFAULT_USER_ID,)
        ).fetchone()[0]
    finally:
        conn.close()

    assert user_count == 1
    assert watchlist_count == len(DEFAULT_WATCHLIST)


def test_init_db_creates_parent_directory(tmp_path):
    nested = tmp_path / "deeply" / "nested" / "finally.db"
    init_db(str(nested))
    assert nested.exists()


def test_watchlist_unique_constraint(tmp_path):
    db_path = str(tmp_path / "finally.db")
    init_db(db_path)

    conn = sqlite3.connect(db_path)
    try:
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                ("dup", DEFAULT_USER_ID, "AAPL", "2026-01-01T00:00:00+00:00"),
            )
            conn.commit()
    finally:
        conn.close()


def test_trades_side_check_constraint(tmp_path):
    db_path = str(tmp_path / "finally.db")
    init_db(db_path)

    conn = sqlite3.connect(db_path)
    try:
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                ("t1", DEFAULT_USER_ID, "AAPL", "invalid", 1.0, 100.0, "2026-01-01T00:00:00+00:00"),
            )
            conn.commit()
    finally:
        conn.close()
