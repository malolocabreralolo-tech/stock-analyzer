'use client';

import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { FinancialData } from '@/types';

interface MetricConfig {
  key: string;
  label: string;
  category: 'absolute' | 'ratio';
  format: 'currency' | 'percent' | 'number';
  color: string;
  computed?: (f: FinancialData) => number | null;
}

const METRICS: MetricConfig[] = [
  // Absolute values (left axis)
  { key: 'revenue', label: 'Revenue', category: 'absolute', format: 'currency', color: '#3b82f6' },
  { key: 'netIncome', label: 'Net Income', category: 'absolute', format: 'currency', color: '#22c55e' },
  { key: 'ebitda', label: 'EBITDA', category: 'absolute', format: 'currency', color: '#8b5cf6' },
  { key: 'freeCashFlow', label: 'Free Cash Flow', category: 'absolute', format: 'currency', color: '#14b8a6' },
  { key: 'operatingCashFlow', label: 'Operating Cash Flow', category: 'absolute', format: 'currency', color: '#06b6d4' },
  { key: 'totalDebt', label: 'Total Debt', category: 'absolute', format: 'currency', color: '#ef4444' },
  { key: 'totalEquity', label: 'Total Equity', category: 'absolute', format: 'currency', color: '#f97316' },

  // Ratios & percentages (right axis)
  { key: 'pe', label: 'P/E', category: 'ratio', format: 'number', color: '#ec4899' },
  { key: 'evEbitda', label: 'EV/EBITDA', category: 'ratio', format: 'number', color: '#a855f7' },
  { key: 'pb', label: 'P/B', category: 'ratio', format: 'number', color: '#f43f5e' },
  { key: 'ps', label: 'P/S', category: 'ratio', format: 'number', color: '#d946ef' },
  { key: 'roe', label: 'ROE', category: 'ratio', format: 'percent', color: '#0ea5e9' },
  { key: 'roic', label: 'ROIC', category: 'ratio', format: 'percent', color: '#0284c7' },
  { key: 'grossMargin', label: 'Gross Margin', category: 'ratio', format: 'percent', color: '#84cc16' },
  { key: 'operatingMargin', label: 'Op. Margin', category: 'ratio', format: 'percent', color: '#eab308' },
  { key: 'netMargin', label: 'Net Margin', category: 'ratio', format: 'percent', color: '#f59e0b' },
  { key: 'debtToEquity', label: 'Debt/Equity', category: 'ratio', format: 'number', color: '#dc2626' },
  {
    key: 'netDebtToEbitda',
    label: 'Net Debt/EBITDA',
    category: 'ratio',
    format: 'number',
    color: '#b91c1c',
    computed: (f: FinancialData) => {
      if (f.totalDebt != null && f.ebitda != null && f.ebitda !== 0) {
        return f.totalDebt / f.ebitda;
      }
      return null;
    },
  },
  { key: 'currentRatio', label: 'Current Ratio', category: 'ratio', format: 'number', color: '#059669' },
  { key: 'revenueGrowth', label: 'Revenue Growth', category: 'ratio', format: 'percent', color: '#2563eb' },
  { key: 'dividendYield', label: 'Div. Yield', category: 'ratio', format: 'percent', color: '#7c3aed' },
];

const PRESETS: { label: string; keys: string[] }[] = [
  { label: 'Valoración', keys: ['pe', 'evEbitda', 'pb'] },
  { label: 'Rentabilidad', keys: ['roe', 'grossMargin', 'operatingMargin', 'netMargin'] },
  { label: 'Deuda', keys: ['debtToEquity', 'netDebtToEbitda', 'currentRatio'] },
  { label: 'Crecimiento', keys: ['revenue', 'netIncome', 'revenueGrowth'] },
];

interface InteractiveChartProps {
  financials: FinancialData[];
}

export default function InteractiveChart({ financials }: InteractiveChartProps) {
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(['pe', 'evEbitda']));

  const chartData = useMemo(() => {
    return [...financials].reverse().map((f) => {
      const point: Record<string, string | number | null> = {
        period: f.period.replace('-FY', ''),
      };
      for (const metric of METRICS) {
        if (metric.computed) {
          point[metric.key] = metric.computed(f);
        } else {
          point[metric.key] = f[metric.key as keyof FinancialData] as number | null;
        }
      }
      return point;
    });
  }, [financials]);

  const activeConfigs = METRICS.filter((m) => activeMetrics.has(m.key));
  const hasAbsolute = activeConfigs.some((m) => m.category === 'absolute');
  const hasRatio = activeConfigs.some((m) => m.category === 'ratio');

  const toggleMetric = (key: string) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyPreset = (keys: string[]) => {
    setActiveMetrics(new Set(keys));
  };

  const clearAll = () => setActiveMetrics(new Set());

  const formatCurrency = (val: number) => {
    if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
    return `$${val.toFixed(0)}`;
  };

  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;

  const formatTooltipValue = (value: number, metric: MetricConfig) => {
    if (metric.format === 'currency') return formatCurrency(value);
    if (metric.format === 'percent') return formatPercent(value);
    return value.toFixed(2);
  };

  const absoluteMetrics = METRICS.filter((m) => m.category === 'absolute');
  const ratioMetrics = METRICS.filter((m) => m.category === 'ratio');

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset.keys)}
            className="px-3 py-1 text-xs font-medium rounded-full border border-border hover:bg-accent transition-colors"
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => applyPreset(METRICS.map((m) => m.key))}
          className="px-3 py-1 text-xs font-medium rounded-full border border-border hover:bg-accent transition-colors"
        >
          Todo
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-1 text-xs font-medium rounded-full border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
        >
          Limpiar
        </button>
      </div>

      {/* Metric selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Valores Absolutos (Eje Izq.)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {absoluteMetrics.map((m) => (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors"
                style={{
                  borderColor: activeMetrics.has(m.key) ? m.color : undefined,
                  backgroundColor: activeMetrics.has(m.key) ? `${m.color}15` : undefined,
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: m.color, opacity: activeMetrics.has(m.key) ? 1 : 0.3 }}
                />
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Ratios / Porcentajes (Eje Der.)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ratioMetrics.map((m) => (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors"
                style={{
                  borderColor: activeMetrics.has(m.key) ? m.color : undefined,
                  backgroundColor: activeMetrics.has(m.key) ? `${m.color}15` : undefined,
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: m.color, opacity: activeMetrics.has(m.key) ? 1 : 0.3 }}
                />
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {activeConfigs.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm border rounded-lg">
          Selecciona métricas para visualizar
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />

            {hasAbsolute && (
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 10 }}
                tickFormatter={formatCurrency}
                width={70}
              />
            )}
            {hasRatio && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }}
                tickFormatter={(val: number) => {
                  const hasPercentMetrics = activeConfigs.some(
                    (m) => m.category === 'ratio' && m.format === 'percent',
                  );
                  return hasPercentMetrics ? formatPercent(val) : val.toFixed(1);
                }}
                width={60}
              />
            )}

            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => {
                const metric = METRICS.find((m) => m.key === name);
                if (!metric || value == null) return ['-', String(name)];
                return [formatTooltipValue(Number(value), metric), metric.label];
              }}
            />

            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value: string) => {
                const metric = METRICS.find((m) => m.key === value);
                return metric?.label || value;
              }}
            />

            {activeConfigs.map((metric) => {
              const yAxisId = metric.category === 'absolute' ? 'left' : 'right';
              // Use Bar for single absolute metric, Line otherwise
              const useBar = metric.category === 'absolute' && activeConfigs.filter((m) => m.category === 'absolute').length === 1;

              if (useBar) {
                return (
                  <Bar
                    key={metric.key}
                    dataKey={metric.key}
                    yAxisId={yAxisId}
                    fill={metric.color}
                    radius={[4, 4, 0, 0]}
                    name={metric.key}
                  />
                );
              }

              return (
                <Line
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  yAxisId={yAxisId}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: metric.color }}
                  connectNulls
                  name={metric.key}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
