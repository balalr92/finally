import type {
  Portfolio,
  TradeRequest,
  PortfolioSnapshot,
  WatchlistEntry,
  ChatMessage,
  ChatRequest,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// Portfolio

export function getPortfolio(): Promise<Portfolio> {
  return request<Portfolio>("/api/portfolio");
}

export function executeTrade(trade: TradeRequest): Promise<Portfolio> {
  return request<Portfolio>("/api/portfolio/trade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trade),
  });
}

export function getPortfolioHistory(): Promise<PortfolioSnapshot[]> {
  return request<PortfolioSnapshot[]>("/api/portfolio/history");
}

// Watchlist

export function getWatchlist(): Promise<WatchlistEntry[]> {
  return request<WatchlistEntry[]>("/api/watchlist");
}

export function addToWatchlist(ticker: string): Promise<WatchlistEntry> {
  return request<WatchlistEntry>("/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker }),
  });
}

export function removeFromWatchlist(ticker: string): Promise<void> {
  return request<void>(`/api/watchlist/${encodeURIComponent(ticker)}`, {
    method: "DELETE",
  });
}

// Chat

export function sendChatMessage(message: string): Promise<ChatMessage> {
  const body: ChatRequest = { message };
  return request<ChatMessage>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
