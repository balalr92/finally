"""FinAlly FastAPI application entrypoint.

Wires the market data subsystem, lazily initializes the SQLite database,
and serves the static frontend bundle alongside the API routes.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.portfolio import _build_portfolio
from app.api.portfolio import router as portfolio_router
from app.api.watchlist import router as watchlist_router
from app.db import get_default_db_path, init_db
from app.db import repository as repo
from app.market import PriceCache, create_market_data_source, create_stream_router
from app.market.seed_prices import SEED_PRICES

logger = logging.getLogger(__name__)


DEFAULT_TICKERS: list[str] = list(SEED_PRICES.keys())
SNAPSHOT_INTERVAL_SECONDS = 30.0


async def _snapshot_loop(db_path: str, cache: PriceCache, interval: float) -> None:
    """Periodically record portfolio total value to portfolio_snapshots."""
    while True:
        try:
            await asyncio.sleep(interval)
            conn = sqlite3.connect(db_path)
            try:
                portfolio = _build_portfolio(conn, cache)
                repo.add_portfolio_snapshot(conn, portfolio.total_value)
            finally:
                conn.close()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Portfolio snapshot loop iteration failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database, start the market data source, tear down on exit."""
    db_path = os.environ.get("DB_PATH") or get_default_db_path()
    logger.info("Initializing database at %s", db_path)
    init_db(db_path)
    app.state.db_path = db_path

    source = create_market_data_source(app.state.price_cache)
    await source.start(DEFAULT_TICKERS)
    app.state.market_source = source

    snapshot_task = asyncio.create_task(
        _snapshot_loop(db_path, app.state.price_cache, SNAPSHOT_INTERVAL_SECONDS)
    )
    app.state.snapshot_task = snapshot_task

    try:
        yield
    finally:
        snapshot_task.cancel()
        try:
            await snapshot_task
        except asyncio.CancelledError:
            pass
        await source.stop()


def create_app() -> FastAPI:
    """Build the FastAPI application.

    The PriceCache is constructed eagerly so the SSE router can be wired in at
    startup time. The market data source that writes to the cache is started in
    the lifespan so the background task lives only for the app's runtime.
    """
    app = FastAPI(title="FinAlly", version="0.1.0", lifespan=lifespan)

    price_cache = PriceCache()
    app.state.price_cache = price_cache

    app.include_router(create_stream_router(price_cache))
    app.include_router(portfolio_router)
    app.include_router(watchlist_router)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    static_dir = Path(__file__).resolve().parent.parent / "static"
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    else:
        logger.info("Static directory %s not found; skipping static mount.", static_dir)

    return app


app = create_app()
