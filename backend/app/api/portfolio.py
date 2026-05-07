"""Portfolio REST endpoints: positions, trade execution, value history."""

from __future__ import annotations

import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_price_cache
from app.db import repository as repo
from app.market import PriceCache

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class TradeRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)
    quantity: float = Field(..., gt=0)
    side: Literal["buy", "sell"]


class PositionView(BaseModel):
    ticker: str
    quantity: float
    avg_cost: float
    current_price: float | None
    unrealized_pnl: float
    pnl_pct: float


class PortfolioView(BaseModel):
    cash_balance: float
    positions: list[PositionView]
    total_value: float


def _build_portfolio(conn: sqlite3.Connection, cache: PriceCache) -> PortfolioView:
    profile = repo.get_user_profile(conn)
    cash = float(profile["cash_balance"])

    positions: list[PositionView] = []
    positions_value = 0.0
    for row in repo.get_positions(conn):
        ticker = row["ticker"]
        qty = float(row["quantity"])
        avg_cost = float(row["avg_cost"])
        current = cache.get_price(ticker)

        if current is None:
            unrealized = 0.0
            pnl_pct = 0.0
        else:
            unrealized = (current - avg_cost) * qty
            cost_basis = avg_cost * qty
            pnl_pct = (unrealized / cost_basis * 100.0) if cost_basis else 0.0
            positions_value += current * qty

        positions.append(
            PositionView(
                ticker=ticker,
                quantity=qty,
                avg_cost=avg_cost,
                current_price=current,
                unrealized_pnl=unrealized,
                pnl_pct=pnl_pct,
            )
        )

    return PortfolioView(
        cash_balance=cash,
        positions=positions,
        total_value=cash + positions_value,
    )


@router.get("", response_model=PortfolioView)
def get_portfolio(
    conn: sqlite3.Connection = Depends(get_db),
    cache: PriceCache = Depends(get_price_cache),
) -> PortfolioView:
    """Return current portfolio: cash, positions with P&L, total value."""
    return _build_portfolio(conn, cache)


@router.post("/trade", response_model=PortfolioView)
def execute_trade(
    body: TradeRequest,
    conn: sqlite3.Connection = Depends(get_db),
    cache: PriceCache = Depends(get_price_cache),
) -> PortfolioView:
    """Execute a market order. Validates funds/shares, updates state, snapshots."""
    ticker = body.ticker.upper()
    qty = body.quantity

    price = cache.get_price(ticker)
    if price is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No live price for {ticker}",
        )

    profile = repo.get_user_profile(conn)
    cash = float(profile["cash_balance"])
    existing = repo.get_position(conn, ticker)

    if body.side == "buy":
        cost = price * qty
        if cost > cash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient cash: need ${cost:.2f}, have ${cash:.2f}",
            )
        if existing:
            old_qty = float(existing["quantity"])
            old_cost = float(existing["avg_cost"])
            new_qty = old_qty + qty
            new_avg = ((old_qty * old_cost) + (qty * price)) / new_qty
        else:
            new_qty = qty
            new_avg = price
        repo.update_cash_balance(conn, cash - cost)
        repo.upsert_position(conn, ticker, new_qty, new_avg)
    else:  # sell
        if not existing or float(existing["quantity"]) < qty:
            held = float(existing["quantity"]) if existing else 0.0
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient shares: need {qty}, have {held}",
            )
        proceeds = price * qty
        new_qty = float(existing["quantity"]) - qty
        repo.update_cash_balance(conn, cash + proceeds)
        if new_qty <= 0:
            repo.delete_position(conn, ticker)
        else:
            repo.upsert_position(conn, ticker, new_qty, float(existing["avg_cost"]))

    repo.add_trade(conn, ticker, body.side, qty, price)

    portfolio = _build_portfolio(conn, cache)
    repo.add_portfolio_snapshot(conn, portfolio.total_value)
    return portfolio


@router.get("/history")
def get_history(conn: sqlite3.Connection = Depends(get_db)) -> list[dict]:
    """Return portfolio total-value snapshots in chronological order."""
    return repo.get_portfolio_snapshots(conn)
