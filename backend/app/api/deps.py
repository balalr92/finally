"""Shared FastAPI dependencies for API routes."""

from __future__ import annotations

import sqlite3
from collections.abc import Generator

from fastapi import Depends, Request

from app.market import PriceCache


def get_db_path(request: Request) -> str:
    """Return the SQLite path stored on app.state by the lifespan."""
    return request.app.state.db_path


def get_db(db_path: str = Depends(get_db_path)) -> Generator[sqlite3.Connection, None, None]:
    """Yield a SQLite connection scoped to one request."""
    conn = sqlite3.connect(db_path)
    try:
        yield conn
    finally:
        conn.close()


def get_price_cache(request: Request) -> PriceCache:
    """Return the shared PriceCache from app.state."""
    return request.app.state.price_cache


def get_market_source(request: Request):
    """Return the running MarketDataSource from app.state."""
    return request.app.state.market_source
