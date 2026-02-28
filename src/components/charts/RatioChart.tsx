'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { FinancialData } from '@/types';

interface RatioChartProps {
  financials: FinancialData[];
  metric: keyof FinancialData;
  title: string;
  format?: 'percent' | 'number' | 'currency';
  type?: 'bar' | 'line';
  color?: string;
}

export default function RatioChart({
  financials,
  metric,
  title,
  format = 'number',
  type = 'bar',
  color = '#3b82f6',
}: RatioChartProps) {
  const data = [...financials]
    .reverse()
    .filter((f) => f[metric] != null)
    .map((f) => ({
      period: f.period.replace('-FY', ''),
      value: f[metric] as number,
    }));

  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No data for {title}
      </div>
    );
  }

  const formatValue = (val: number) => {
    if (format === 'percent') return `${(val * 100).toFixed(1)}%`;
    if (format === 'currency') return `$${(val / 1e9).toFixed(1)}B`;
    return val.toFixed(1);
  };

  const Chart = type === 'line' ? LineChart : BarChart;

  return (
    <div>
      <h4 className="text-sm font-medium mb-2 text-muted-foreground">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <Chart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatValue} />
          <Tooltip
            formatter={(value) => [formatValue(Number(value)), title]}
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          />
          {type === 'line' ? (
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 4 }} />
          ) : (
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
