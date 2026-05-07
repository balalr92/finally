"""CRUD repository functions for FinAlly's SQLite database.

All functions operate on a ``sqlite3.Connection`` and target the default user
(``user_id = "default"``).  The caller is responsible for connection lifecycle
and committing transactions when desired (mutating helpers ``commit()`` so
callers can use them directly without bookkeeping).
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from app.db.init_db import DEFAULT_USER_ID

JsonObj = dict[str, Any]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(cursor: sqlite3.Cursor, row: tuple[Any, ...]) -> JsonObj:
    return {col[0]: row[i] for i, col in enumerate(cursor.description)}


# ---------- user profile ----------

def get_user_profile(conn: sqlite3.Connection) -> JsonObj:
    """Return ``{id, cash_balance, created_at}`` for the default user."""
    cursor = conn.execute(
        "SELECT id, cash_balance, created_at FROM users_profile WHERE id = ?",
        (DEFAULT_USER_ID,),
    )
    row = cursor.fetchone()
    if row is None:
        raise LookupError(f"user profile not found: {DEFAULT_USER_ID}")
    return _row_to_dict(cursor, row)


def update_cash_balance(conn: sqlite3.Connection, new_balance: float) -> None:
    """Set the default user's cash balance."""
    conn.execute(
        "UPDATE users_profile SET cash_balance = ? WHERE id = ?",
        (new_balance, DEFAULT_USER_ID),
    )
    conn.commit()


# ---------- watchlist ----------

def get_watchlist(conn: sqlite3.Connection) -> list[str]:
    """Return tickers in the default user's watchlist, ordered by added_at."""
    rows = conn.execute(
        "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at, ticker",
        (DEFAULT_USER_ID,),
    ).fetchall()
    return [row[0] for row in rows]


def add_to_watchlist(conn: sqlite3.Connection, ticker: str) -> None:
    """Add a ticker to the watchlist.

    Raises ``sqlite3.IntegrityError`` if the ticker is already present.
    """
    ticker = ticker.upper()
    conn.execute(
        "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
        (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, _now_iso()),
    )
    conn.commit()


def remove_from_watchlist(conn: sqlite3.Connection, ticker: str) -> bool:
    """Remove a ticker; returns True if a row was deleted."""
    cursor = conn.execute(
        "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
        (DEFAULT_USER_ID, ticker.upper()),
    )
    conn.commit()
    return cursor.rowcount > 0


# ---------- positions ----------

def get_positions(conn: sqlite3.Connection) -> list[JsonObj]:
    """Return all open positions as dicts."""
    cursor = conn.execute(
        "SELECT ticker, quantity, avg_cost, updated_at "
        "FROM positions WHERE user_id = ? ORDER BY ticker",
        (DEFAULT_USER_ID,),
    )
    rows = cursor.fetchall()
    return [_row_to_dict(cursor, row) for row in rows]


def get_position(conn: sqlite3.Connection, ticker: str) -> JsonObj | None:
    """Return a single position or ``None``."""
    cursor = conn.execute(
        "SELECT ticker, quantity, avg_cost, updated_at "
        "FROM positions WHERE user_id = ? AND ticker = ?",
        (DEFAULT_USER_ID, ticker.upper()),
    )
    row = cursor.fetchone()
    return _row_to_dict(cursor, row) if row else None


def upsert_position(
    conn: sqlite3.Connection, ticker: str, quantity: float, avg_cost: float
) -> None:
    """Insert or update a position, identified by (user_id, ticker)."""
    ticker = ticker.upper()
    now = _now_iso()
    conn.execute(
        """
        INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, ticker) DO UPDATE SET
            quantity = excluded.quantity,
            avg_cost = excluded.avg_cost,
            updated_at = excluded.updated_at
        """,
        (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, quantity, avg_cost, now),
    )
    conn.commit()


def delete_position(conn: sqlite3.Connection, ticker: str) -> bool:
    """Delete a position; returns True if a row was deleted."""
    cursor = conn.execute(
        "DELETE FROM positions WHERE user_id = ? AND ticker = ?",
        (DEFAULT_USER_ID, ticker.upper()),
    )
    conn.commit()
    return cursor.rowcount > 0


# ---------- trades ----------

def add_trade(
    conn: sqlite3.Connection,
    ticker: str,
    side: str,
    quantity: float,
    price: float,
) -> JsonObj:
    """Append a trade to the log and return it as a dict."""
    if side not in ("buy", "sell"):
        raise ValueError(f"side must be 'buy' or 'sell', got {side!r}")
    trade_id = str(uuid.uuid4())
    executed_at = _now_iso()
    conn.execute(
        "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (trade_id, DEFAULT_USER_ID, ticker.upper(), side, quantity, price, executed_at),
    )
    conn.commit()
    return {
        "id": trade_id,
        "user_id": DEFAULT_USER_ID,
        "ticker": ticker.upper(),
        "side": side,
        "quantity": quantity,
        "price": price,
        "executed_at": executed_at,
    }


def get_trades(conn: sqlite3.Connection, limit: int = 100) -> list[JsonObj]:
    """Return the most recent trades, newest first."""
    cursor = conn.execute(
        "SELECT id, ticker, side, quantity, price, executed_at "
        "FROM trades WHERE user_id = ? ORDER BY executed_at DESC, id DESC LIMIT ?",
        (DEFAULT_USER_ID, limit),
    )
    rows = cursor.fetchall()
    return [_row_to_dict(cursor, row) for row in rows]


# ---------- portfolio snapshots ----------

def add_portfolio_snapshot(conn: sqlite3.Connection, total_value: float) -> JsonObj:
    """Record a portfolio total value snapshot."""
    snap_id = str(uuid.uuid4())
    recorded_at = _now_iso()
    conn.execute(
        "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) "
        "VALUES (?, ?, ?, ?)",
        (snap_id, DEFAULT_USER_ID, total_value, recorded_at),
    )
    conn.commit()
    return {
        "id": snap_id,
        "user_id": DEFAULT_USER_ID,
        "total_value": total_value,
        "recorded_at": recorded_at,
    }


def get_portfolio_snapshots(conn: sqlite3.Connection, limit: int = 200) -> list[JsonObj]:
    """Return recent portfolio snapshots, oldest first (suitable for charting)."""
    cursor = conn.execute(
        """
        SELECT total_value, recorded_at FROM (
            SELECT total_value, recorded_at
            FROM portfolio_snapshots
            WHERE user_id = ?
            ORDER BY recorded_at DESC
            LIMIT ?
        ) ORDER BY recorded_at ASC
        """,
        (DEFAULT_USER_ID, limit),
    )
    rows = cursor.fetchall()
    return [_row_to_dict(cursor, row) for row in rows]


# ---------- chat messages ----------

def add_chat_message(
    conn: sqlite3.Connection,
    role: str,
    content: str,
    actions: JsonObj | list[Any] | None = None,
) -> JsonObj:
    """Persist a chat message. ``actions`` is JSON-encoded if provided."""
    if role not in ("user", "assistant"):
        raise ValueError(f"role must be 'user' or 'assistant', got {role!r}")
    msg_id = str(uuid.uuid4())
    created_at = _now_iso()
    actions_json = json.dumps(actions) if actions is not None else None
    conn.execute(
        "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (msg_id, DEFAULT_USER_ID, role, content, actions_json, created_at),
    )
    conn.commit()
    return {
        "id": msg_id,
        "user_id": DEFAULT_USER_ID,
        "role": role,
        "content": content,
        "actions": actions,
        "created_at": created_at,
    }


def get_chat_messages(conn: sqlite3.Connection, limit: int = 50) -> list[JsonObj]:
    """Return recent chat messages in chronological order (oldest first)."""
    cursor = conn.execute(
        """
        SELECT id, role, content, actions, created_at FROM (
            SELECT id, role, content, actions, created_at
            FROM chat_messages
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
        ) ORDER BY created_at ASC, id ASC
        """,
        (DEFAULT_USER_ID, limit),
    )
    rows = cursor.fetchall()
    messages: list[JsonObj] = []
    for row in rows:
        msg = _row_to_dict(cursor, row)
        if msg["actions"] is not None:
            msg["actions"] = json.loads(msg["actions"])
        messages.append(msg)
    return messages
