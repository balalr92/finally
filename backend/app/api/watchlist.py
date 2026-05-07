"""Watchlist REST endpoints."""

from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_market_source, get_price_cache
from app.db import repository as repo
from app.market import MarketDataSource, PriceCache

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistItem(BaseModel):
    ticker: str
    price: float | None
    previous_price: float | None
    change: float | None
    change_percent: float | None
    direction: str | None


class AddTickerRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)


def _to_item(ticker: str, cache: PriceCache) -> WatchlistItem:
    update = cache.get(ticker)
    if update is None:
        return WatchlistItem(
            ticker=ticker,
            price=None,
            previous_price=None,
            change=None,
            change_percent=None,
            direction=None,
        )
    return WatchlistItem(
        ticker=ticker,
        price=update.price,
        previous_price=update.previous_price,
        change=update.change,
        change_percent=update.change_percent,
        direction=update.direction,
    )


@router.get("", response_model=list[WatchlistItem])
def get_watchlist(
    conn: sqlite3.Connection = Depends(get_db),
    cache: PriceCache = Depends(get_price_cache),
) -> list[WatchlistItem]:
    """Return watchlist tickers with their latest prices."""
    return [_to_item(t, cache) for t in repo.get_watchlist(conn)]


@router.post("", response_model=list[WatchlistItem], status_code=status.HTTP_201_CREATED)
async def add_ticker(
    body: AddTickerRequest,
    conn: sqlite3.Connection = Depends(get_db),
    cache: PriceCache = Depends(get_price_cache),
    source: MarketDataSource = Depends(get_market_source),
) -> list[WatchlistItem]:
    """Add a ticker to the watchlist and start streaming prices for it."""
    ticker = body.ticker.upper()
    try:
        repo.add_to_watchlist(conn, ticker)
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{ticker} already in watchlist",
        )

    await source.add_ticker(ticker)
    return [_to_item(t, cache) for t in repo.get_watchlist(conn)]


@router.delete("/{ticker}", response_model=list[WatchlistItem])
async def remove_ticker(
    ticker: str,
    conn: sqlite3.Connection = Depends(get_db),
    cache: PriceCache = Depends(get_price_cache),
    source: MarketDataSource = Depends(get_market_source),
) -> list[WatchlistItem]:
    """Remove a ticker from the watchlist and stop streaming it."""
    ticker = ticker.upper()
    if not repo.remove_from_watchlist(conn, ticker):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ticker} not in watchlist",
        )
    await source.remove_ticker(ticker)
    return [_to_item(t, cache) for t in repo.get_watchlist(conn)]
