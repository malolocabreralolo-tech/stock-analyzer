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
import { DynamicRatioPoint, FinancialData } from '@/types';

interface MetricConfig {
  key: string;
  label: string;
  category: 'absolute' | 'ratio';
  format: 'currency' | 'percent' | 'number';
  color: string;
  dynamicKey?: string;
}

const METRICS: MetricConfig[] = [
  { key: 'revenue', label: 'Revenue', category: 'absolute', format: 'currency', color: '#3b82f6', dynamicKey: 'revenueTTM' },
  { key: 'netIncome', label: 'Net Income', category: 'absolute', format: 'currency', color: '#22c55e', dynamicKey: 'netIncomeTTM' },
  { key: 'ebitda', label: 'EBITDA', category: 'absolute', format: 'currency', color: '#8b5cf6', dynamicKey: 'ebitdaTTM' },
  { key: 'freeCashFlow', label: 'Free Cash Flow', category: 'absolute', format: 'currency', color: '#14b8a6', dynamicKey: 'fcfTTM' },
  { key: 'operatingCashFlow', label: 'Op. Cash Flow', category: 'absolute', format: 'currency', color: '#06b6d4' },
  { key: 'totalDebt', label: 'Total Debt', category: 'absolute', format: 'currency', color: '#ef4444' },
  { key: 'totalEquity', label: 'Total Equity', category: 'absolute', format: 'currency', color: '#f97316' },
  { key: 'price', label: 'Price', category: 'absolute', format: 'currency', color: '#64748b' },
  { key: 'pe', label: 'P/E', category: 'ratio', format: 'number', color: '#ec4899' },
  { key: 'evEbitda', label: 'EV/EBITDA', category: 'ratio', format: 'number', color: '#a855f7' },
  { key: 'pb', label: 'P/B', category: 'ratio', format: 'number', color: '#f43f5e' },
  { key: 'ps', label: 'P/S', category: 'ratio', format: 'number', color: '#d946ef' },
  { key: 'roe', label: 'ROE', category: 'ratio', format: 'percent', color: '#0ea5e9' },
  { key: 'grossMargin', label: 'Gross Margin', category: 'ratio', format: 'percent', color: '#84cc16' },
  { key: 'operatingMargin', label: 'Op. Margin', category: 'ratio', format: 'percent', color: '#eab308' },
  { key: 'netMargin', label: 'Net Margin', category: 'ratio', format: 'percent', color: '#f59e0b' },
  { key: 'debtToEquity', label: 'Debt/Equity', category: 'ratio', format: 'number', color: '#dc2626' },
  { key: 'netDebtToEbitda', label: 'Net Debt/EBITDA', category: 'ratio', format: 'number', color: '#b91c1c' },
];

const DYNAMIC_KEYS = new Set([
  'price', 'pe', 'evEbitda', 'pb', 'ps', 'netDebtToEbitda',
  'roe', 'grossMargin', 'operatingMargin', 'netMargin', 'debtToEquity',
  'revenueTTM', 'netIncomeTTM', 'ebitdaTTM', 'fcfTTM',
]);

const PRESETS: { label: string; keys: string[] }[] = [
  { label: 'Valoración', keys: ['pe', 'evEbitda', 'pb'] },
  { label: 'Rentabilidad', keys: ['roe', 'grossMargin', 'operatingMargin', 'netMargin'] },
  { label: 'Deuda', keys: ['debtToEquity', 'netDebtToEbitda'] },
  { label: 'Crecimiento', keys: ['revenue', 'netIncome', 'ebitda'] },
];

type TimeRange = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y' | '10Y' | '20Y' | 'MAX';
const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1Y' },
  { key: '3Y', label: '3Y' },
  { key: '5Y', label: '5Y' },
  { key: '10Y', label: '10Y' },
  { key: '20Y', label: '20Y' },
  { key: 'MAX', label: 'MAX' },
];

function getTimeRangeCutoff(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case '1M': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case '3M': return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case '6M': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case 'YTD': return new Date(now.getFullYear(), 0, 1);
    case '1Y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case '3Y': return new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
    case '5Y': return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    case '10Y': return new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
    case '20Y': return new Date(now.getFullYear() - 20, now.getMonth(), now.getDate());
    case 'MAX': return new Date(2000, 0, 1);
  }
}

interface InteractiveChartProps {
  financials: FinancialData[];
  dynamicRatios?: DynamicRatioPoint[];
}

export default function InteractiveChart({ financials, dynamicRatios = [] }: InteractiveChartProps) {
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(['pe', 'evEbitda']));
  const [timeRange, setTimeRange] = useState<TimeRange>('5Y');
  const hasDynamic = dynamicRatios.length > 0;

  const activeConfigs = METRICS.filter((m) => activeMetrics.has(m.key));

  const useDynamicChart = useMemo(() => {
    if (!hasDynamic) return false;
    return activeConfigs.some((m) => {
      const dk = m.dynamicKey || m.key;
      return DYNAMIC_KEYS.has(dk);
    });
  }, [hasDynamic, activeConfigs]);

  // Annual chart data
  const annualData = useMemo(() => {
    return [...financials].reverse().map((f) => {
      const point: Record<string, string | number | null> = {
        period: f.period.replace('-FY', ''),
      };
      for (const metric of METRICS) {
        if (metric.key === 'netDebtToEbitda') {
          point[metric.key] = f.totalDebt != null && f.ebitda != null && f.ebitda !== 0
            ? f.totalDebt / f.ebitda : null;
        } else if (metric.key === 'price') {
          point[metric.key] = null;
        } else {
          point[metric.key] = f[metric.key as keyof FinancialData] as number | null;
        }
      }
      return point;
    });
  }, [financials]);

  // Dynamic chart data (daily time series) filtered by time range
  const dynamicData = useMemo(() => {
    if (!hasDynamic) return [];
    const cutoff = getTimeRangeCutoff(timeRange);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return dynamicRatios
      .filter((d) => d.date >= cutoffStr)
      .map((d) => ({
        date: d.date,
        label: d.date,
        price: d.price,
        pe: d.pe,
        evEbitda: d.evEbitda,
        pb: d.pb,
        ps: d.ps,
        netDebtToEbitda: d.netDebtToEbitda,
        revenueTTM: d.revenueTTM,
        netIncomeTTM: d.netIncomeTTM,
        ebitdaTTM: d.ebitdaTTM,
        fcfTTM: d.fcfTTM,
        roe: d.roe,
        grossMargin: d.grossMargin,
        operatingMargin: d.operatingMargin,
        netMargin: d.netMargin,
        debtToEquity: d.debtToEquity,
        revenue: d.revenueTTM,
        netIncome: d.netIncomeTTM,
        ebitda: d.ebitdaTTM,
        freeCashFlow: d.fcfTTM,
      }));
  }, [hasDynamic, dynamicRatios, timeRange]);

  const chartData = useDynamicChart ? dynamicData : annualData;
  const xKey = useDynamicChart ? 'label' : 'period';

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

  const applyPreset = (keys: string[]) => setActiveMetrics(new Set(keys));
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

  // Format X-axis ticks based on time range
  const formatXTick = (dateStr: string) => {
    if (!useDynamicChart) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (timeRange === '1M' || timeRange === '3M') {
      return `${d.getDate()} ${months[d.getMonth()]}`;
    }
    if (timeRange === '6M' || timeRange === 'YTD' || timeRange === '1Y') {
      return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    }
    return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  };

  // Format tooltip date
  const formatTooltipDate = (dateStr: string) => {
    if (!useDynamicChart) return `FY ${dateStr}`;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Calculate X-axis tick interval based on data density
  const xInterval = useMemo(() => {
    if (!useDynamicChart) return 0;
    const len = chartData.length;
    // Show ~10-12 ticks regardless of data size
    return Math.max(0, Math.floor(len / 10) - 1);
  }, [useDynamicChart, chartData.length]);

  const absoluteMetrics = METRICS.filter((m) => m.category === 'absolute');
  const ratioMetrics = METRICS.filter((m) => m.category === 'ratio');

  return (
    <div className="space-y-4">
{/* Time range selector + Presets row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Time range buttons */}
        {useDynamicChart && (
          <div className="flex rounded-lg border border-border overflow-hidden">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.key}
                onClick={() => setTimeRange(tr.key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                  timeRange === tr.key
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
        )}

        {/* Separator */}
        {useDynamicChart && <div className="w-px h-6 bg-border" />}

        {/* Metric presets */}
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset.keys)}
            className="px-3 py-1.5 text-xs font-medium rounded-full border border-border hover:bg-accent transition-colors"
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={clearAll}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
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
        <div className="h-[450px] flex items-center justify-center text-muted-foreground text-sm border rounded-lg">
          Selecciona métricas para visualizar
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={450}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 9 }}
              tickFormatter={formatXTick}
              interval={xInterval}
              angle={useDynamicChart ? -45 : 0}
              textAnchor={useDynamicChart ? 'end' : 'middle'}
              height={useDynamicChart ? 50 : 30}
            />

            {hasAbsolute && (
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 10 }}
                tickFormatter={(val: number) => {
                  const absMetrics = activeConfigs.filter((m) => m.category === 'absolute');
                  if (absMetrics.every((m) => m.key === 'price')) {
                    return `$${val.toFixed(0)}`;
                  }
                  return formatCurrency(val);
                }}
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
              labelFormatter={(label) => formatTooltipDate(String(label))}
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

              if (!useDynamicChart && metric.category === 'absolute' && activeConfigs.filter((m) => m.category === 'absolute').length === 1) {
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
                  strokeWidth={1.5}
                  dot={useDynamicChart ? false : { r: 3, fill: metric.color }}
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
