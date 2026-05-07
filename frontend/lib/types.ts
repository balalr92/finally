/** Price update from SSE stream — matches PriceUpdate.to_dict() */
export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: string;
  change: number;
  change_percent: number;
  direction: "up" | "down" | "flat";
}

/** Watchlist entry with latest price data — matches GET /api/watchlist response */
export interface WatchlistEntry {
  ticker: string;
  price: number | null;
  previous_price: number | null;
  change: number | null;
  change_percent: number | null;
  direction: "up" | "down" | "unchanged" | null;
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
