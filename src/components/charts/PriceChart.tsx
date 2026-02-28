'use client';

import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { HistoricalPrice } from '@/types';

type TimeRange = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y' | 'MAX';

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1Y' },
  { key: '3Y', label: '3Y' },
  { key: '5Y', label: '5Y' },
  { key: 'MAX', label: 'MAX' },
];

function getCutoff(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case '1M': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case '3M': return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case '6M': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case 'YTD': return new Date(now.getFullYear(), 0, 1);
    case '1Y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case '3Y': return new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
    case '5Y': return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    case 'MAX': return new Date(2000, 0, 1);
  }
}

interface PriceChartProps {
  data: HistoricalPrice[];
  fairValue?: number;
}

export default function PriceChart({ data, fairValue }: PriceChartProps) {
  const [range, setRange] = useState<TimeRange>('1Y');

  const filteredData = useMemo(() => {
    if (data.length === 0) return [];
    const cutoff = getCutoff(range).toISOString().split('T')[0];
    return data.filter((d) => d.date >= cutoff);
  }, [data, range]);

  if (data.length === 0) {
    return <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">No price data available</div>;
  }

  // Sample to reduce points
  const step = Math.max(1, Math.floor(filteredData.length / 300));
  const sampled = filteredData.filter((_, i) => i % step === 0 || i === filteredData.length - 1);

  const chartData = sampled.map((d) => ({
    date: d.date,
    price: d.close,
    volume: d.volume,
    ...(fairValue ? { fairValue } : {}),
  }));

  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices) * 0.97;
  const maxPrice = Math.max(...prices) * 1.03;
  const maxVolume = Math.max(...chartData.map((d) => d.volume || 0));

  const isPositive = chartData.length >= 2 && chartData[chartData.length - 1].price >= chartData[0].price;
  const strokeColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div className="space-y-3">
      {/* Time range selector — scrollable on mobile */}
      <div className="overflow-x-auto">
        <div className="flex rounded-lg border border-border overflow-hidden w-fit min-w-max">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.key}
              onClick={() => setRange(tr.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                range === tr.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-muted-foreground'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(val) => {
              const d = new Date(val + 'T00:00:00');
              const mon = d.toLocaleString('en-US', { month: 'short' });
              if (range === '1M' || range === '3M') return `${mon} ${d.getDate()}`;
              if (range === '6M' || range === 'YTD' || range === '1Y') return `${mon} '${d.getFullYear().toString().slice(2)}`;
              return `${mon} '${d.getFullYear().toString().slice(2)}`;
            }}
            interval={Math.max(0, Math.floor(sampled.length / 6) - 1)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="price"
            domain={[minPrice, maxPrice]}
            tick={{ fontSize: 10 }}
            tickFormatter={(val) => `$${val.toFixed(0)}`}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            domain={[0, maxVolume * 5]}
            hide
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const v = Number(value);
              if (name === 'volume') return [`${(v / 1e6).toFixed(1)}M`, 'Volume'];
              return [`$${v.toFixed(2)}`, name === 'fairValue' ? 'Fair Value' : 'Price'];
            }}
            labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            contentStyle={{
              backgroundColor: 'var(--color-popover)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          {/* Volume bars */}
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill={strokeColor}
            opacity={0.15}
            name="volume"
          />
          {/* Price area */}
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            fill="url(#priceGradient)"
            strokeWidth={1.5}
            name="price"
            dot={false}
          />
          {/* Fair value line */}
          {fairValue && (
            <ReferenceLine
              yAxisId="price"
              y={fairValue}
              stroke="#3b82f6"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: `Fair: $${fairValue.toFixed(0)}`, position: 'right', fontSize: 10, fill: '#3b82f6' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
