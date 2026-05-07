'use client';

import { useEffect, useState } from 'react';
import { useSSE } from '../lib/useSSE';
import { getPortfolio, getWatchlist } from '../lib/api';
import type { WatchlistEntry } from '../lib/types';
import Header from '../components/Header';
import WatchlistPanel from '../components/WatchlistPanel';

export default function Home() {
  const { prices, sparklines, status } = useSSE();
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  useEffect(() => {
    getPortfolio().then((p) => {
      setTotalValue(p.total_value);
      setCash(p.cash_balance);
    });
    getWatchlist().then((w) => {
      setWatchlist(w);
      if (w.length > 0) setSelectedTicker(w[0].ticker);
    });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-bg-base text-text-primary overflow-hidden">
      <Header totalValue={totalValue} cash={cash} connectionStatus={status} />

      {/* Main content: three-column layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left column: Watchlist */}
        <aside className="w-72 shrink-0 flex flex-col border-r border-border-muted bg-bg-panel overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle text-xs font-semibold text-text-muted uppercase tracking-wider">
            Watchlist
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <WatchlistPanel
              watchlist={watchlist}
              prices={prices}
              sparklines={sparklines}
              selectedTicker={selectedTicker}
              onSelectTicker={setSelectedTicker}
            />
          </div>
        </aside>

        {/* Center column: Main chart + Trade bar */}
        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Main chart area */}
          <div className="flex-1 min-h-0 bg-bg-base border-b border-border-muted p-3 flex flex-col">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Chart
            </div>
            <div className="flex-1 flex items-center justify-center text-text-muted text-xs border border-border-subtle rounded">
              {/* MainChart component goes here */}
              Select a ticker to view chart
            </div>
          </div>

          {/* Trade bar */}
          <div className="shrink-0 px-4 py-2 bg-bg-elevated border-b border-border-muted flex items-center gap-4">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Trade
            </span>
            <input
              readOnly
              placeholder="Ticker"
              className="w-20 px-2 py-1 text-xs bg-bg-panel border border-border-muted rounded text-text-primary placeholder:text-text-muted font-mono"
            />
            <input
              readOnly
              placeholder="Quantity"
              className="w-24 px-2 py-1 text-xs bg-bg-panel border border-border-muted rounded text-text-primary placeholder:text-text-muted font-mono"
            />
            <button className="px-3 py-1 text-xs font-semibold bg-up text-white rounded">
              Buy
            </button>
            <button className="px-3 py-1 text-xs font-semibold bg-down text-white rounded">
              Sell
            </button>
          </div>

          {/* Bottom row: heatmap + P&L chart + positions table */}
          <div className="flex min-h-0 overflow-hidden" style={{ height: '260px' }}>
            {/* Portfolio heatmap */}
            <div className="flex flex-col w-56 shrink-0 border-r border-border-muted bg-bg-panel p-2">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                Holdings
              </div>
              <div className="flex-1 flex items-center justify-center text-text-muted text-xs border border-border-subtle rounded">
                {/* PortfolioHeatmap goes here */}
                Heatmap
              </div>
            </div>

            {/* P&L chart */}
            <div className="flex flex-col flex-1 min-w-0 border-r border-border-muted bg-bg-panel p-2">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                Portfolio P&amp;L
              </div>
              <div className="flex-1 flex items-center justify-center text-text-muted text-xs border border-border-subtle rounded">
                {/* PnLChart goes here */}
                P&amp;L chart
              </div>
            </div>

            {/* Positions table */}
            <div className="flex flex-col flex-1 min-w-0 bg-bg-panel p-2 overflow-hidden">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                Positions
              </div>
              <div className="flex-1 overflow-y-auto text-text-muted text-xs border border-border-subtle rounded flex items-center justify-center">
                {/* PositionsTable goes here */}
                Positions table
              </div>
            </div>
          </div>
        </main>

        {/* Right column: AI Chat panel */}
        <aside className="w-80 shrink-0 flex flex-col border-l border-border-muted bg-bg-panel overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              AI Assistant
            </span>
            <span className="text-accent-yellow text-xs font-mono">FinAlly</span>
          </div>
          {/* Chat history */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-text-muted text-xs">
            {/* ChatPanel message list goes here */}
            Ask me anything about your portfolio…
          </div>
          {/* Chat input */}
          <div className="shrink-0 p-3 border-t border-border-subtle flex gap-2">
            <input
              readOnly
              placeholder="Message FinAlly…"
              className="flex-1 px-3 py-2 text-xs bg-bg-elevated border border-border-muted rounded text-text-primary placeholder:text-text-muted"
            />
            <button className="px-3 py-2 text-xs font-semibold bg-accent-purple text-white rounded">
              Send
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
