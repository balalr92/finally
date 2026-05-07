'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PortfolioSnapshot } from '../lib/types';

interface PnLChartProps {
  snapshots: PortfolioSnapshot[];
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtValue(v: number): string {
  return `$${(v / 1000).toFixed(1)}k`;
}

export default function PnLChart({ snapshots }: PnLChartProps) {
  if (snapshots.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-xs border border-border-subtle rounded">
        Waiting for data...
      </div>
    );
  }

  const data = snapshots.map((s) => ({
    time: fmtTime(s.recorded_at),
    value: s.total_value,
  }));

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.1 || 500;

  return (
    <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
          <XAxis
            dataKey="time"
            stroke="#21262d"
            tick={{ fontSize: 9, fill: '#8b949e' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#21262d"
            tick={{ fontSize: 9, fill: '#8b949e' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtValue}
            width={42}
            domain={[min - pad, max + pad]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '4px',
              fontSize: '11px',
              padding: '4px 8px',
            }}
            labelStyle={{ color: '#8b949e' }}
            itemStyle={{ color: '#ecad0a' }}
            formatter={(v) =>
              typeof v === 'number'
                ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                : String(v)
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#ecad0a"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
