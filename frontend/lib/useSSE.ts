'use client';

import { useEffect, useRef, useState } from 'react';
import type { PriceUpdate } from './types';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface SSEState {
  prices: Map<string, PriceUpdate>;
  sparklines: Map<string, number[]>;
  status: ConnectionStatus;
}

const MAX_SPARKLINE_POINTS = 60;

export function useSSE() {
  const [state, setState] = useState<SSEState>({
    prices: new Map(),
    sparklines: new Map(),
    status: 'disconnected',
  });

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/stream/prices');
    esRef.current = es;

    es.onopen = () => {
      setState((prev) => ({ ...prev, status: 'connected' }));
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        // SSE payload is {ticker: PriceUpdate, ...} for all tickers at once
        const batch = JSON.parse(event.data as string) as Record<string, PriceUpdate>;
        setState((prev) => {
          const prices = new Map(prev.prices);
          const sparklines = new Map(prev.sparklines);

          for (const update of Object.values(batch)) {
            prices.set(update.ticker, update);
            const history = sparklines.get(update.ticker) ?? [];
            const next = [...history, update.price];
            sparklines.set(
              update.ticker,
              next.length > MAX_SPARKLINE_POINTS
                ? next.slice(next.length - MAX_SPARKLINE_POINTS)
                : next
            );
          }

          return { prices, sparklines, status: 'connected' };
        });
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setState((prev) => ({ ...prev, status: 'reconnecting' }));
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return { prices: state.prices, sparklines: state.sparklines, status: state.status };
}
