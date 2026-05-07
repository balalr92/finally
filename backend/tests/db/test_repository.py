"""Tests for the database repository module."""

from __future__ import annotations

import sqlite3

import pytest

from app.db import repository as repo
from app.db.init_db import DEFAULT_CASH_BALANCE, DEFAULT_WATCHLIST, init_db


@pytest.fixture
def conn(tmp_path) -> sqlite3.Connection:
    """A freshly initialized SQLite database for each test."""
    db_path = str(tmp_path / "finally.db")
    init_db(db_path)
    connection = sqlite3.connect(db_path)
    yield connection
    connection.close()


# ---------- user profile ----------

def test_get_user_profile_returns_default(conn):
    profile = repo.get_user_profile(conn)
    assert profile["id"] == "default"
    assert profile["cash_balance"] == pytest.approx(DEFAULT_CASH_BALANCE)


def test_update_cash_balance(conn):
    repo.update_cash_balance(conn, 5000.50)
    profile = repo.get_user_profile(conn)
    assert profile["cash_balance"] == pytest.approx(5000.50)


# ---------- watchlist ----------

def test_get_watchlist_default(conn):
    tickers = repo.get_watchlist(conn)
    assert set(tickers) == set(DEFAULT_WATCHLIST)


def test_add_to_watchlist(conn):
    repo.add_to_watchlist(conn, "PYPL")
    assert "PYPL" in repo.get_watchlist(conn)


def test_add_to_watchlist_uppercases(conn):
    repo.add_to_watchlist(conn, "pypl")
    assert "PYPL" in repo.get_watchlist(conn)


def test_add_to_watchlist_duplicate_raises(conn):
    with pytest.raises(sqlite3.IntegrityError):
        repo.add_to_watchlist(conn, "AAPL")  # already seeded


def test_remove_from_watchlist(conn):
    assert repo.remove_from_watchlist(conn, "AAPL") is True
    assert "AAPL" not in repo.get_watchlist(conn)


def test_remove_from_watchlist_missing_returns_false(conn):
    assert repo.remove_from_watchlist(conn, "ZZZZ") is False


# ---------- positions ----------

def test_positions_empty_initially(conn):
    assert repo.get_positions(conn) == []


def test_upsert_position_insert(conn):
    repo.upsert_position(conn, "AAPL", 10.0, 190.0)
    positions = repo.get_positions(conn)
    assert len(positions) == 1
    assert positions[0]["ticker"] == "AAPL"
    assert positions[0]["quantity"] == pytest.approx(10.0)
    assert positions[0]["avg_cost"] == pytest.approx(190.0)


def test_upsert_position_update(conn):
    repo.upsert_position(conn, "AAPL", 10.0, 190.0)
    repo.upsert_position(conn, "AAPL", 15.0, 195.0)
    positions = repo.get_positions(conn)
    assert len(positions) == 1
    assert positions[0]["quantity"] == pytest.approx(15.0)
    assert positions[0]["avg_cost"] == pytest.approx(195.0)


def test_get_position_single(conn):
    repo.upsert_position(conn, "AAPL", 5.0, 200.0)
    pos = repo.get_position(conn, "AAPL")
    assert pos is not None
    assert pos["quantity"] == pytest.approx(5.0)
    assert repo.get_position(conn, "MSFT") is None


def test_delete_position(conn):
    repo.upsert_position(conn, "AAPL", 10.0, 190.0)
    assert repo.delete_position(conn, "AAPL") is True
    assert repo.get_positions(conn) == []
    assert repo.delete_position(conn, "AAPL") is False


# ---------- trades ----------

def test_add_trade_returns_dict(conn):
    trade = repo.add_trade(conn, "AAPL", "buy", 10.0, 190.0)
    assert trade["ticker"] == "AAPL"
    assert trade["side"] == "buy"
    assert trade["quantity"] == pytest.approx(10.0)
    assert trade["price"] == pytest.approx(190.0)
    assert "id" in trade and "executed_at" in trade


def test_add_trade_invalid_side(conn):
    with pytest.raises(ValueError):
        repo.add_trade(conn, "AAPL", "short", 1.0, 100.0)


def test_get_trades_newest_first(conn):
    repo.add_trade(conn, "AAPL", "buy", 1.0, 100.0)
    repo.add_trade(conn, "MSFT", "buy", 2.0, 200.0)
    repo.add_trade(conn, "GOOGL", "sell", 3.0, 300.0)
    trades = repo.get_trades(conn)
    assert len(trades) == 3
    # newest first
    assert trades[0]["ticker"] == "GOOGL"
    assert trades[-1]["ticker"] == "AAPL"


def test_get_trades_respects_limit(conn):
    for i in range(5):
        repo.add_trade(conn, "AAPL", "buy", 1.0, 100.0 + i)
    trades = repo.get_trades(conn, limit=3)
    assert len(trades) == 3


# ---------- portfolio snapshots ----------

def test_add_and_get_portfolio_snapshots(conn):
    repo.add_portfolio_snapshot(conn, 10000.0)
    repo.add_portfolio_snapshot(conn, 10100.0)
    repo.add_portfolio_snapshot(conn, 10050.0)
    snapshots = repo.get_portfolio_snapshots(conn)
    assert len(snapshots) == 3
    # chronological order (oldest first)
    values = [s["total_value"] for s in snapshots]
    assert values == [10000.0, 10100.0, 10050.0]


def test_portfolio_snapshots_limit(conn):
    for value in range(10):
        repo.add_portfolio_snapshot(conn, float(value))
    snapshots = repo.get_portfolio_snapshots(conn, limit=3)
    assert len(snapshots) == 3
    # the limit pulls the *most recent* 3, returned chronologically
    values = [s["total_value"] for s in snapshots]
    assert values == [7.0, 8.0, 9.0]


# ---------- chat messages ----------

def test_add_chat_message_user(conn):
    msg = repo.add_chat_message(conn, "user", "Hello")
    assert msg["role"] == "user"
    assert msg["content"] == "Hello"
    assert msg["actions"] is None


def test_add_chat_message_with_actions(conn):
    actions = {"trades": [{"ticker": "AAPL", "side": "buy", "quantity": 1}]}
    msg = repo.add_chat_message(conn, "assistant", "Bought AAPL", actions=actions)
    assert msg["actions"] == actions


def test_add_chat_message_invalid_role(conn):
    with pytest.raises(ValueError):
        repo.add_chat_message(conn, "system", "no")


def test_get_chat_messages_chronological(conn):
    repo.add_chat_message(conn, "user", "first")
    repo.add_chat_message(conn, "assistant", "second")
    repo.add_chat_message(conn, "user", "third")
    messages = repo.get_chat_messages(conn)
    contents = [m["content"] for m in messages]
    assert contents == ["first", "second", "third"]


def test_get_chat_messages_decodes_actions(conn):
    actions = [{"ticker": "AAPL", "action": "add"}]
    repo.add_chat_message(conn, "assistant", "Added", actions=actions)
    messages = repo.get_chat_messages(conn)
    assert messages[0]["actions"] == actions


def test_get_chat_messages_limit(conn):
    for i in range(10):
        repo.add_chat_message(conn, "user", f"msg-{i}")
    messages = repo.get_chat_messages(conn, limit=3)
    assert len(messages) == 3
    # most recent 3, chronological
    contents = [m["content"] for m in messages]
    assert contents == ["msg-7", "msg-8", "msg-9"]
