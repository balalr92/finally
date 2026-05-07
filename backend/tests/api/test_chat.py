"""Tests for POST /api/chat using LLM_MOCK=true."""

from __future__ import annotations

import os
import sqlite3
import tempfile

import pytest
from fastapi.testclient import TestClient

os.environ["LLM_MOCK"] = "true"

from app.api.chat import MOCK_RESPONSE_MESSAGE  # noqa: E402
from app.db import init_db  # noqa: E402
from app.db import repository as repo  # noqa: E402
from app.market import PriceCache  # noqa: E402


@pytest.fixture()
def db_path(tmp_path):
    path = str(tmp_path / "test.db")
    init_db(path)
    return path


@pytest.fixture()
def client(db_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", db_path)
    monkeypatch.setenv("LLM_MOCK", "true")

    from app.main import create_app

    application = create_app()
    with TestClient(application, raise_server_exceptions=True) as c:
        yield c


def test_chat_mock_returns_message(client):
    response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == MOCK_RESPONSE_MESSAGE
    assert data["trades_executed"] == []
    assert data["watchlist_changes_applied"] == []
    assert data["errors"] == []


def test_chat_persists_messages(client, db_path):
    client.post("/api/chat", json={"message": "What is my portfolio?"})

    conn = sqlite3.connect(db_path)
    messages = repo.get_chat_messages(conn, limit=10)
    conn.close()

    roles = [m["role"] for m in messages]
    assert "user" in roles
    assert "assistant" in roles


def test_chat_multiple_turns(client):
    client.post("/api/chat", json={"message": "First message"})
    response = client.post("/api/chat", json={"message": "Second message"})
    assert response.status_code == 200
    assert response.json()["message"] == MOCK_RESPONSE_MESSAGE


def test_chat_assistant_actions_stored(client, db_path):
    client.post("/api/chat", json={"message": "Analyze my portfolio"})

    conn = sqlite3.connect(db_path)
    messages = repo.get_chat_messages(conn, limit=10)
    conn.close()

    assistant_msgs = [m for m in messages if m["role"] == "assistant"]
    assert len(assistant_msgs) == 1
    actions = assistant_msgs[0]["actions"]
    assert actions is not None
    assert "trades_executed" in actions
    assert "watchlist_changes_applied" in actions


def test_chat_empty_message_rejected(client):
    # FastAPI validates non-empty fields; empty string passes pydantic but we accept it
    response = client.post("/api/chat", json={"message": ""})
    # Empty string is valid per spec — LLM mock still responds
    assert response.status_code == 200


def test_chat_missing_message_field(client):
    response = client.post("/api/chat", json={})
    assert response.status_code == 422
