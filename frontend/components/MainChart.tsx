'use client';

import { useEffect, useRef } from 'react';
import { createOptionsChart, LineSeries } from 'lightweight-charts';
import type { IChartApiBase, ISeriesApi } from 'lightweight-charts';

interface MainChartProps {
  ticker: string | null;
  data: number[];
}

export default function MainChart({ ticker, data }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApiBase<number> | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line', number> | null>(null);

  useEffect(() => {
    if (!containerRef.current || !ticker) {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
      return;
    }

    const chart = createOptionsChart(containerRef.current, {
      layout: {
        background: { color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      rightPriceScale: { borderColor: '#30363d' },
      timeScale: { visible: false },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addSeries(LineSeries, {
      color: '#209dd7',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.resize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight,
        );
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [ticker]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (data.length === 0) {
      seriesRef.current.setData([]);
      return;
    }
    seriesRef.current.setData(data.map((value, i) => ({ time: i, value })));
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="absolute inset-0" />
      {!ticker && (
        <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs border border-border-subtle rounded">
          Select a ticker to view chart
        </div>
      )}
    </div>
  );
}
