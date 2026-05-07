'use client';

import { useEffect, useRef, useState } from 'react';
import { sendChatMessage } from '../lib/api';

interface TradeExecution {
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
}

interface WatchlistChange {
  ticker: string;
  action: 'add' | 'remove';
}

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  trades?: TradeExecution[];
  watchlistChanges?: WatchlistChange[];
  errors?: string[];
}

interface ChatPanelProps {
  onPortfolioRefresh: () => void;
}

function TradeCard({ trade }: { trade: TradeExecution }) {
  const verb = trade.side === 'buy' ? 'Bought' : 'Sold';
  const price = trade.price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
  const accent = trade.side === 'buy' ? 'border-accent-blue text-accent-blue' : 'border-accent-purple text-accent-purple';
  return (
    <div className={`mt-1.5 px-2 py-1 bg-bg-base border-l-2 ${accent} rounded-r text-xs font-mono`}>
      <span className="font-bold">{verb}</span> {trade.quantity} {trade.ticker} @ {price}
    </div>
  );
}

function WatchlistCard({ change }: { change: WatchlistChange }) {
  const verb = change.action === 'add' ? 'Added' : 'Removed';
  const prep = change.action === 'add' ? 'to' : 'from';
  return (
    <div className="mt-1.5 px-2 py-1 bg-bg-base border-l-2 border-accent-yellow rounded-r text-xs font-mono">
      <span className="font-bold text-accent-yellow">{verb}</span> {change.ticker} {prep} watchlist
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-start">
      <div className="bg-bg-elevated px-3 py-2 rounded text-xs">
        <span className="inline-flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

export default function ChatPanel({ onPortfolioRefresh }: ChatPanelProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: text },
    ]);
    setInput('');
    setLoading(true);

    try {
      const resp = await sendChatMessage(text);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: resp.message,
          trades: resp.trades_executed,
          watchlistChanges: resp.watchlist_changes_applied,
          errors: resp.errors,
        },
      ]);
      if (resp.trades_executed.length > 0 || resp.watchlist_changes_applied.length > 0) {
        onPortfolioRefresh();
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          errors: [e instanceof Error ? e.message : 'Unknown error'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-text-muted text-xs text-center mt-6">
            Ask me anything about your portfolio…
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[92%] px-3 py-2 rounded text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent-purple text-white'
                  : 'bg-bg-elevated text-text-primary'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'assistant' && (
              <div className="max-w-[92%] w-full">
                {msg.trades?.map((t, i) => <TradeCard key={i} trade={t} />)}
                {msg.watchlistChanges?.map((c, i) => <WatchlistCard key={i} change={c} />)}
                {msg.errors?.map((err, i) => (
                  <div
                    key={i}
                    className="mt-1.5 px-2 py-1 bg-bg-base border-l-2 border-down rounded-r text-xs text-down font-mono"
                  >
                    {err}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <ThinkingDots />}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 p-3 border-t border-border-subtle flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message FinAlly…"
          disabled={loading}
          className="flex-1 px-3 py-2 text-xs bg-bg-elevated border border-border-muted rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple disabled:opacity-50 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-3 py-2 text-xs font-semibold bg-accent-purple text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          Send
        </button>
      </div>
    </>
  );
}
