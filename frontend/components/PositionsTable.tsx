'use client';

import type { Position, PriceUpdate } from '../lib/types';

interface PositionsTableProps {
  positions: Position[];
  prices: Map<string, PriceUpdate>;
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtQty(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(4);
}

export default function PositionsTable({ positions, prices }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        No open positions
      </div>
    );
  }

  return (
    <table className="w-full text-xs font-mono">
      <thead className="sticky top-0 bg-bg-panel z-10">
        <tr className="text-text-muted">
          <th className="text-left px-2 py-1 font-semibold uppercase tracking-wider">Ticker</th>
          <th className="text-right px-2 py-1 font-semibold uppercase tracking-wider">Qty</th>
          <th className="text-right px-2 py-1 font-semibold uppercase tracking-wider">Avg</th>
          <th className="text-right px-2 py-1 font-semibold uppercase tracking-wider">Price</th>
          <th className="text-right px-2 py-1 font-semibold uppercase tracking-wider">P&L</th>
          <th className="text-right px-2 py-1 font-semibold uppercase tracking-wider">%</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((pos) => {
          const live = prices.get(pos.ticker)?.price;
          const currentPrice = live ?? pos.current_price ?? undefined;
          const unrealized =
            currentPrice != null
              ? (currentPrice - pos.avg_cost) * pos.quantity
              : pos.unrealized_pnl ?? 0;
          const pnlPct =
            currentPrice != null && pos.avg_cost > 0
              ? ((currentPrice - pos.avg_cost) / pos.avg_cost) * 100
              : pos.pnl_pct ?? 0;

          const pnlClass =
            unrealized > 0 ? 'text-up' : unrealized < 0 ? 'text-down' : 'text-text-muted';

          return (
            <tr
              key={pos.ticker}
              className="border-t border-border-subtle/40 hover:bg-bg-elevated/30 transition-colors"
            >
              <td className="px-2 py-1 font-bold text-text-primary">{pos.ticker}</td>
              <td className="px-2 py-1 text-right text-text-primary">{fmtQty(pos.quantity)}</td>
              <td className="px-2 py-1 text-right text-text-muted">{fmtCurrency(pos.avg_cost)}</td>
              <td className="px-2 py-1 text-right text-text-primary">{fmtCurrency(currentPrice)}</td>
              <td className={`px-2 py-1 text-right ${pnlClass}`}>{fmtCurrency(unrealized)}</td>
              <td className={`px-2 py-1 text-right ${pnlClass}`}>
                {pnlPct >= 0 ? '+' : ''}
                {pnlPct.toFixed(2)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
