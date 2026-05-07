'use client';

import { useEffect, useRef } from 'react';
import type { WatchlistEntry, PriceUpdate } from '../lib/types';
import Sparkline from './Sparkline';

interface WatchlistPanelProps {
  watchlist: WatchlistEntry[];
  prices: Map<string, PriceUpdate>;
  sparklines: Map<string, number[]>;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
}

function formatPrice(price: number | null): string {
  if (price === null) return '—';
  return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatChangePct(changePct: number | null | undefined): string {
  if (changePct === null || changePct === undefined) return '—';
  const sign = changePct >= 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

interface TickerRowProps {
  entry: WatchlistEntry;
  priceUpdate: PriceUpdate | undefined;
  sparklineData: number[];
  isSelected: boolean;
  onSelect: () => void;
}

function TickerRow({ entry, priceUpdate, sparklineData, isSelected, onSelect }: TickerRowProps) {
  const prevPriceRef = useRef<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const currentPrice = priceUpdate?.price ?? entry.price;
  const direction = priceUpdate?.direction ?? entry.direction;

  useEffect(() => {
    const prev = prevPriceRef.current;
    prevPriceRef.current = currentPrice;

    if (prev === null || currentPrice === null || currentPrice === prev) return;
    if (!rowRef.current) return;

    const cls = direction === 'up' ? 'flash-up' : direction === 'down' ? 'flash-down' : null;
    if (!cls) return;

    rowRef.current.classList.add(cls);
    const timer = setTimeout(() => {
      rowRef.current?.classList.remove(cls);
    }, 500);
    return () => clearTimeout(timer);
  }, [currentPrice, direction]);

  // Prefer SSE change_percent, fall back to REST entry
  const changePct: number | null = priceUpdate?.change_percent ?? entry.change_percent;

  const changePctColor = changePct === null
    ? 'text-text-muted'
    : changePct >= 0
    ? 'text-up'
    : 'text-down';

  return (
    <div
      ref={rowRef}
      onClick={onSelect}
      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer gap-2 ${
        isSelected ? 'bg-bg-elevated' : 'hover:bg-bg-elevated/50'
      }`}
    >
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-mono font-bold text-xs text-text-primary truncate">{entry.ticker}</span>
        <span className="font-mono text-xs text-text-primary">{formatPrice(currentPrice)}</span>
      </div>
      <span className={`font-mono text-xs shrink-0 ${changePctColor}`}>
        {formatChangePct(changePct)}
      </span>
      <div className="shrink-0">
        <Sparkline data={sparklineData} width={60} height={24} />
      </div>
    </div>
  );
}

export default function WatchlistPanel({
  watchlist,
  prices,
  sparklines,
  selectedTicker,
  onSelectTicker,
}: WatchlistPanelProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {watchlist.map((entry) => (
        <TickerRow
          key={entry.ticker}
          entry={entry}
          priceUpdate={prices.get(entry.ticker)}
          sparklineData={sparklines.get(entry.ticker) ?? []}
          isSelected={selectedTicker === entry.ticker}
          onSelect={() => onSelectTicker(entry.ticker)}
        />
      ))}
    </div>
  );
}
