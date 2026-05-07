"""LLM-powered chat endpoint with auto-execution of trades and watchlist changes."""

from __future__ import annotations

import os
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_db, get_market_source, get_price_cache
from app.api.portfolio import _build_portfolio
from app.db import repository as repo
from app.market import MarketDataSource, PriceCache

router = APIRouter(prefix="/api/chat", tags=["chat"])

MOCK_RESPONSE_MESSAGE = (
    "I'm FinAlly, your AI trading assistant. I can analyze your portfolio, "
    "suggest trades, and execute orders. What would you like to do?"
)


class ChatRequest(BaseModel):
    message: str


class TradeAction(BaseModel):
    ticker: str
    side: Literal["buy", "sell"]
    quantity: float


class WatchlistChange(BaseModel):
    ticker: str
    action: Literal["add", "remove"]


class LLMResponse(BaseModel):
    message: str
    trades: list[TradeAction] = []
    watchlist_changes: list[WatchlistChange] = []


class ChatResponse(BaseModel):
    message: str
    trades_executed: list[dict]
    watchlist_changes_applied: list[dict]
    errors: list[str]


def _build_portfolio_context(conn: sqlite3.Connection, cache: PriceCache) -> str:
    portfolio = _build_portfolio(conn, cache)
    watchlist = repo.get_watchlist(conn)

    lines = [
        f"Cash: ${portfolio.cash_balance:,.2f}",
        f"Total value: ${portfolio.total_value:,.2f}",
        "",
        "Positions:",
    ]
    if portfolio.positions:
        for pos in portfolio.positions:
            price_str = f"${pos.current_price:.2f}" if pos.current_price else "N/A"
            lines.append(
                f"  {pos.ticker}: {pos.quantity} shares @ avg ${pos.avg_cost:.2f}, "
                f"current {price_str}, P&L ${pos.unrealized_pnl:.2f} ({pos.pnl_pct:.1f}%)"
            )
    else:
        lines.append("  (no positions)")

    lines.extend(["", "Watchlist: " + ", ".join(watchlist)])
    return "\n".join(lines)


def _build_system_prompt(portfolio_context: str) -> str:
    return f"""You are FinAlly, an AI trading assistant for a simulated trading workstation.

Current portfolio context:
{portfolio_context}

You help users:
- Analyze portfolio composition, risk concentration, and P&L
- Suggest trades with reasoning
- Execute trades when asked or agreed to
- Manage the watchlist proactively

Be concise and data-driven. Confirm executed trades and watchlist changes in your message.
Always respond with valid JSON matching the required schema."""


def _call_llm(system_prompt: str, messages: list[dict]) -> LLMResponse:
    from openai import OpenAI

    client = OpenAI()
    response = client.responses.parse(
        model="gpt-5.4-mini",
        input=[{"role": "system", "content": system_prompt}] + messages,
        text_format=LLMResponse,
    )
    return response.output_parsed


def _execute_trade(
    conn: sqlite3.Connection, cache: PriceCache, trade: TradeAction
) -> dict | str:
    """Execute a single trade; returns result dict on success or error string on failure."""
    ticker = trade.ticker.upper()
    price = cache.get_price(ticker)
    if price is None:
        return f"No live price for {ticker}"

    profile = repo.get_user_profile(conn)
    cash = float(profile["cash_balance"])
    existing = repo.get_position(conn, ticker)

    if trade.side == "buy":
        cost = price * trade.quantity
        if cost > cash:
            return f"Insufficient cash for {ticker}: need ${cost:.2f}, have ${cash:.2f}"
        if existing:
            old_qty = float(existing["quantity"])
            old_cost = float(existing["avg_cost"])
            new_qty = old_qty + trade.quantity
            new_avg = ((old_qty * old_cost) + (trade.quantity * price)) / new_qty
        else:
            new_qty = trade.quantity
            new_avg = price
        repo.update_cash_balance(conn, cash - cost)
        repo.upsert_position(conn, ticker, new_qty, new_avg)
    else:
        if not existing or float(existing["quantity"]) < trade.quantity:
            held = float(existing["quantity"]) if existing else 0.0
            return f"Insufficient shares for {ticker}: need {trade.quantity}, have {held}"
        proceeds = price * trade.quantity
        new_qty = float(existing["quantity"]) - trade.quantity
        repo.update_cash_balance(conn, cash + proceeds)
        if new_qty <= 0:
            repo.delete_position(conn, ticker)
        else:
            repo.upsert_position(conn, ticker, new_qty, float(existing["avg_cost"]))

    repo.add_trade(conn, ticker, trade.side, trade.quantity, price)
    return {"ticker": ticker, "side": trade.side, "quantity": trade.quantity, "price": price}


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    conn: sqlite3.Connection = Depends(get_db),
    cache: PriceCache = Depends(get_price_cache),
    source: MarketDataSource = Depends(get_market_source),
) -> ChatResponse:
    """Send a user message; LLM responds and may auto-execute trades/watchlist changes."""
    repo.add_chat_message(conn, "user", body.message)

    portfolio_context = _build_portfolio_context(conn, cache)
    system_prompt = _build_system_prompt(portfolio_context)

    history = repo.get_chat_messages(conn, limit=20)
    messages = [{"role": msg["role"], "content": msg["content"]} for msg in history]

    if os.environ.get("LLM_MOCK", "").lower() == "true":
        llm_result = LLMResponse(message=MOCK_RESPONSE_MESSAGE)
    else:
        llm_result = _call_llm(system_prompt, messages)

    trades_executed: list[dict] = []
    watchlist_changes_applied: list[dict] = []
    errors: list[str] = []

    for trade in llm_result.trades:
        result = _execute_trade(conn, cache, trade)
        if isinstance(result, str):
            errors.append(result)
        else:
            trades_executed.append(result)
            portfolio = _build_portfolio(conn, cache)
            repo.add_portfolio_snapshot(conn, portfolio.total_value)

    for change in llm_result.watchlist_changes:
        ticker = change.ticker.upper()
        try:
            if change.action == "add":
                repo.add_to_watchlist(conn, ticker)
                await source.add_ticker(ticker)
                watchlist_changes_applied.append({"ticker": ticker, "action": "add"})
            else:
                if repo.remove_from_watchlist(conn, ticker):
                    await source.remove_ticker(ticker)
                    watchlist_changes_applied.append({"ticker": ticker, "action": "remove"})
        except Exception as e:
            errors.append(f"Watchlist change failed for {ticker}: {e}")

    actions = {
        "trades_executed": trades_executed,
        "watchlist_changes_applied": watchlist_changes_applied,
    }
    repo.add_chat_message(conn, "assistant", llm_result.message, actions)

    return ChatResponse(
        message=llm_result.message,
        trades_executed=trades_executed,
        watchlist_changes_applied=watchlist_changes_applied,
        errors=errors,
    )
