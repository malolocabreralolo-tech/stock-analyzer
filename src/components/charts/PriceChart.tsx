'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { HistoricalPrice } from '@/types';

interface PriceChartProps {
  data: HistoricalPrice[];
  fairValue?: number;
}

export default function PriceChart({ data, fairValue }: PriceChartProps) {
  if (data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No price data available</div>;
  }

  // Sample data to reduce points (show ~250 points max)
  const step = Math.max(1, Math.floor(data.length / 250));
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  const chartData = sampled.map((d) => ({
    date: d.date,
    price: d.close,
    ...(fairValue ? { fairValue } : {}),
  }));

  const minPrice = Math.min(...chartData.map((d) => d.price)) * 0.95;
  const maxPrice = Math.max(...chartData.map((d) => d.price)) * 1.05;

  const isPositive = chartData.length >= 2 && chartData[chartData.length - 1].price >= chartData[0].price;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
            <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(val) => {
            const d = new Date(val);
            return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
          }}
          interval={Math.floor(sampled.length / 6)}
        />
        <YAxis
          domain={[minPrice, maxPrice]}
          tick={{ fontSize: 11 }}
          tickFormatter={(val) => `$${val.toFixed(0)}`}
        />
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Price']}
          labelFormatter={(label) => new Date(label).toLocaleDateString()}
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={isPositive ? '#22c55e' : '#ef4444'}
          fill="url(#priceGradient)"
          strokeWidth={2}
        />
        {fairValue && (
          <Area
            type="monotone"
            dataKey="fairValue"
            stroke="#3b82f6"
            strokeDasharray="5 5"
            fill="none"
            strokeWidth={1.5}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
