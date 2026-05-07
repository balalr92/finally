'use client';

import { useEffect, useState } from 'react';
import { useSSE } from '../lib/useSSE';
import { getPortfolio, getWatchlist, getPortfolioHistory } from '../lib/api';
import type { WatchlistEntry, Position, PortfolioSnapshot, Portfolio } from '../lib/types';
import Header from '../components/Header';
import WatchlistPanel from '../components/WatchlistPanel';
import MainChart from '../components/MainChart';
import PnLChart from '../components/PnLChart';
import PortfolioHeatmap from '../components/PortfolioHeatmap';
import PositionsTable from '../components/PositionsTable';
import TradeBar from '../components/TradeBar';

export default function Home() {
  const { prices, sparklines, status } = useSSE();
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);

  function applyPortfolio(p: Portfolio) {
    setTotalValue(p.total_value);
    setCash(p.cash_balance);
    setPositions(p.positions);
  }

  useEffect(() => {
    getPortfolio().then(applyPortfolio);
    getPortfolioHistory().then(setSnapshots);
    getWatchlist().then((w) => {
      setWatchlist(w);
      if (w.length > 0) setSelectedTicker(w[0].ticker);
    });
  }, []);

  function handleTradeComplete(portfolio: Portfolio) {
    applyPortfolio(portfolio);
    getPortfolioHistory().then(setSnapshots);
  }

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

        {/* Center column */}
        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Main chart */}
          <div className="flex-1 min-h-0 bg-bg-base border-b border-border-muted p-3 flex flex-col">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              {selectedTicker ? `${selectedTicker} — Price` : 'Chart'}
            </div>
            <MainChart
              ticker={selectedTicker}
              data={selectedTicker ? (sparklines.get(selectedTicker) ?? []) : []}
            />
          </div>

          {/* Trade bar */}
          <TradeBar selectedTicker={selectedTicker} onTradeComplete={handleTradeComplete} />

          {/* Bottom row: heatmap + P&L chart + positions table */}
          <div className="flex min-h-0 overflow-hidden" style={{ height: '260px' }}>
            {/* Portfolio heatmap */}
            <div className="flex flex-col w-52 shrink-0 border-r border-border-muted bg-bg-panel p-2">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                Holdings
              </div>
              <PortfolioHeatmap positions={positions} prices={prices} />
            </div>

            {/* P&L chart */}
            <div className="flex flex-col flex-1 min-w-0 border-r border-border-muted bg-bg-panel p-2">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                Portfolio P&amp;L
              </div>
              <PnLChart snapshots={snapshots} />
            </div>

            {/* Positions table */}
            <div className="flex flex-col flex-1 min-w-0 bg-bg-panel p-2 overflow-hidden">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                Positions
              </div>
              <div className="flex-1 overflow-y-auto">
                <PositionsTable positions={positions} prices={prices} />
              </div>
            </div>
          </div>
        </main>

        {/* Right column: AI chat sidebar (placeholder — implemented in Task #9) */}
        <aside className="w-80 shrink-0 flex flex-col border-l border-border-muted bg-bg-panel overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              AI Assistant
            </span>
            <span className="text-accent-yellow text-xs font-mono">FinAlly</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-text-muted text-xs">
            Ask me anything about your portfolio…
          </div>
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
