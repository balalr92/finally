'use client';

import { useEffect, useRef, useState } from 'react';
import { Treemap } from 'recharts';
import type { TreemapNode } from 'recharts';
import type { Position, PriceUpdate } from '../lib/types';

interface HeatmapProps {
  positions: Position[];
  prices: Map<string, PriceUpdate>;
}

function pnlColor(pnl: number): string {
  if (pnl > 0) return '#16a34a';
  if (pnl < 0) return '#dc2626';
  return '#30363d';
}

function renderCell(props: TreemapNode): React.ReactElement {
  const { x, y, width, height, name } = props;
  const fill = typeof props['fill'] === 'string' ? props['fill'] : '#30363d';
  const pnlPct = typeof props['pnlPct'] === 'number' ? props['pnlPct'] : 0;

  if (width < 8 || height < 8) return <g />;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#0d1117"
        strokeWidth={1.5}
        rx={2}
      />
      {width > 32 && height > 18 && (
        <text
          x={x + width / 2}
          y={y + (height > 36 ? height / 2 - 6 : height / 2 + 4)}
          textAnchor="middle"
          fill="#fff"
          fontSize={10}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {name}
        </text>
      )}
      {width > 32 && height > 36 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 8}
          textAnchor="middle"
          fill="rgba(255,255,255,0.8)"
          fontSize={9}
          fontFamily="monospace"
        >
          {pnlPct >= 0 ? '+' : ''}
          {pnlPct.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

export default function PortfolioHeatmap({ positions, prices }: HeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDims({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const data = positions.map((pos) => {
    const livePrice = prices.get(pos.ticker)?.price ?? pos.current_price ?? pos.avg_cost;
    const posValue = livePrice * pos.quantity;
    const pnl = (livePrice - pos.avg_cost) * pos.quantity;
    const pnlPct =
      pos.avg_cost > 0 ? ((livePrice - pos.avg_cost) / pos.avg_cost) * 100 : 0;
    return {
      name: pos.ticker,
      value: posValue,
      fill: pnlColor(pnl),
      pnlPct,
    };
  });

  return (
    <div ref={containerRef} className="flex-1 min-h-0">
      {positions.length === 0 ? (
        <div className="h-full flex items-center justify-center text-text-muted text-xs border border-border-subtle rounded">
          No positions
        </div>
      ) : dims ? (
        <Treemap
          width={dims.width}
          height={dims.height}
          data={data}
          dataKey="value"
          content={renderCell}
          isAnimationActive={false}
        />
      ) : null}
    </div>
  );
}
