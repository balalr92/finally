/** Price update from SSE stream */
export interface PriceUpdate {
  ticker: string;
  price: number;
  prev_price: number;
  timestamp: string;
  direction: "up" | "down" | "unchanged";
}

/** Watchlist entry with latest price data */
export interface WatchlistEntry {
  id: string;
  ticker: string;
  price: number | null;
  prev_price: number | null;
  direction: "up" | "down" | "unchanged" | null;
  added_at: string;
}

/** A single open position */
export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number | null;
  unrealized_pnl: number | null;
  pnl_pct: number | null;
}

/** Full portfolio response */
export interface Portfolio {
  cash_balance: number;
  total_value: number;
  positions: Position[];
}

/** A trade request body */
export interface TradeRequest {
  ticker: string;
  quantity: number;
  side: "buy" | "sell";
}

/** A trade record */
export interface Trade {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  executed_at: string;
}

/** A portfolio value snapshot (for the P&L chart) */
export interface PortfolioSnapshot {
  id: string;
  total_value: number;
  recorded_at: string;
}

/** A chat message stored in history */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: ChatActions | null;
  created_at: string;
}

/** Actions the AI executed alongside a message */
export interface ChatActions {
  trades?: Trade[];
  watchlist_changes?: WatchlistChange[];
  errors?: string[];
}

export interface WatchlistChange {
  ticker: string;
  action: "add" | "remove";
}

/** Request body for chat */
export interface ChatRequest {
  message: string;
}
