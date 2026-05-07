'use client';

import type { ConnectionStatus } from '../lib/useSSE';

interface HeaderProps {
  totalValue: number | null;
  cash: number | null;
  connectionStatus: ConnectionStatus;
}

function fmt(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

const statusDot: Record<ConnectionStatus, string> = {
  connected: 'bg-up',
  reconnecting: 'bg-yellow-400',
  disconnected: 'bg-down',
};

const statusLabel: Record<ConnectionStatus, string> = {
  connected: 'Live',
  reconnecting: 'Reconnecting',
  disconnected: 'Disconnected',
};

export default function Header({ totalValue, cash, connectionStatus }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border-muted bg-bg-elevated shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-accent-yellow font-bold text-lg tracking-tight font-mono">
          FinAlly
        </span>
        <span className="text-text-muted text-xs">AI Trading Workstation</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-xs text-text-muted uppercase tracking-wider">Total Value</div>
          <div className="text-accent-yellow font-mono font-semibold">{fmt(totalValue)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-muted uppercase tracking-wider">Cash</div>
          <div className="text-text-primary font-mono">{fmt(cash)}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusDot[connectionStatus]}`} title={statusLabel[connectionStatus]} />
          <span className="text-xs text-text-muted">{statusLabel[connectionStatus]}</span>
        </div>
      </div>
    </header>
  );
}
