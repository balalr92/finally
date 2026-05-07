'use client';

import { useState } from 'react';
import { executeTrade } from '../lib/api';
import type { Portfolio } from '../lib/types';

interface TradeBarProps {
  selectedTicker: string | null;
  onTradeComplete: (portfolio: Portfolio) => void;
}

export default function TradeBar({ selectedTicker, onTradeComplete }: TradeBarProps) {
  const [tickerInput, setTickerInput] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Show selectedTicker in input if user hasn't typed their own
  const displayTicker = tickerInput || selectedTicker || '';

  async function handleTrade(side: 'buy' | 'sell') {
    const ticker = displayTicker.trim().toUpperCase();
    const qty = parseFloat(quantity);
    if (!ticker) {
      setError('Enter a ticker');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setError('Enter a valid quantity');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const portfolio = await executeTrade({ ticker, quantity: qty, side });
      onTradeComplete(portfolio);
      setQuantity('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Trade failed';
      // Extract readable error from API response text
      const match = msg.match(/"detail":"([^"]+)"/);
      setError(match ? match[1] : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shrink-0 px-4 py-2 bg-bg-elevated border-b border-border-muted flex items-center gap-3 flex-wrap">
      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Trade</span>
      <input
        value={displayTicker}
        onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
        placeholder="Ticker"
        maxLength={10}
        className="w-20 px-2 py-1 text-xs bg-bg-panel border border-border-muted rounded text-text-primary placeholder:text-text-muted font-mono uppercase focus:outline-none focus:border-accent-blue"
      />
      <input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Quantity"
        type="number"
        min="0.0001"
        step="1"
        className="w-24 px-2 py-1 text-xs bg-bg-panel border border-border-muted rounded text-text-primary placeholder:text-text-muted font-mono focus:outline-none focus:border-accent-blue"
      />
      <button
        onClick={() => handleTrade('buy')}
        disabled={loading}
        className="px-3 py-1 text-xs font-semibold bg-accent-blue text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        Buy
      </button>
      <button
        onClick={() => handleTrade('sell')}
        disabled={loading}
        className="px-3 py-1 text-xs font-semibold bg-accent-purple text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        Sell
      </button>
      {loading && (
        <span className="text-xs text-text-muted font-mono">Executing…</span>
      )}
      {error && !loading && (
        <span className="text-xs text-down font-mono">{error}</span>
      )}
    </div>
  );
}
