'use client';

import { FinancialData } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FinancialTableProps {
  financials: FinancialData[];
}

const formatNumber = (val: number | null, type: 'currency' | 'percent' | 'ratio' = 'currency') => {
  if (val == null) return '\u2014';
  if (type === 'percent') return `${(val * 100).toFixed(1)}%`;
  if (type === 'ratio') return val.toFixed(2);
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toFixed(2)}`;
};

interface MetricDef {
  key: keyof FinancialData;
  label: string;
  type: 'currency' | 'percent' | 'ratio';
}

interface MetricGroup {
  name: string;
  metrics: MetricDef[];
}

const metricGroups: MetricGroup[] = [
  {
    name: 'Income Statement',
    metrics: [
      { key: 'revenue', label: 'Revenue', type: 'currency' },
      { key: 'netIncome', label: 'Net Income', type: 'currency' },
      { key: 'ebitda', label: 'EBITDA', type: 'currency' },
      { key: 'eps', label: 'EPS', type: 'ratio' },
      { key: 'grossMargin', label: 'Gross Margin', type: 'percent' },
      { key: 'operatingMargin', label: 'Operating Margin', type: 'percent' },
      { key: 'netMargin', label: 'Net Margin', type: 'percent' },
    ],
  },
  {
    name: 'Balance Sheet',
    metrics: [
      { key: 'debtToEquity', label: 'Debt/Equity', type: 'ratio' },
      { key: 'currentRatio', label: 'Current Ratio', type: 'ratio' },
    ],
  },
  {
    name: 'Cash Flow',
    metrics: [
      { key: 'freeCashFlow', label: 'Free Cash Flow', type: 'currency' },
    ],
  },
  {
    name: 'Returns',
    metrics: [
      { key: 'roe', label: 'ROE', type: 'percent' },
      { key: 'roic', label: 'ROIC', type: 'percent' },
    ],
  },
  {
    name: 'Valuation',
    metrics: [
      { key: 'pe', label: 'P/E', type: 'ratio' },
      { key: 'evEbitda', label: 'EV/EBITDA', type: 'ratio' },
      { key: 'pb', label: 'P/B', type: 'ratio' },
    ],
  },
  {
    name: 'Growth & Yield',
    metrics: [
      { key: 'revenueGrowth', label: 'Revenue Growth', type: 'percent' },
      { key: 'epsGrowth', label: 'EPS Growth', type: 'percent' },
      { key: 'dividendYield', label: 'Dividend Yield', type: 'percent' },
    ],
  },
];

function getYoYChange(financials: FinancialData[], metricKey: keyof FinancialData, index: number): number | null {
  if (index >= financials.length - 1) return null;
  const current = financials[index][metricKey] as number | null;
  const previous = financials[index + 1][metricKey] as number | null;
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

function TrendArrow({ change }: { change: number | null }) {
  if (change == null) return null;
  if (Math.abs(change) < 0.01) return <Minus className="w-3 h-3 text-muted-foreground inline" />;
  if (change > 0) return <TrendingUp className="w-3 h-3 text-emerald-500 inline" />;
  return <TrendingDown className="w-3 h-3 text-red-500 inline" />;
}

export default function FinancialTable({ financials }: FinancialTableProps) {
  if (financials.length === 0) {
    return <p className="text-muted-foreground text-sm">No financial data available</p>;
  }

  // Compute TTM values from the most recent data
  const latestFY = financials[0];

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-card min-w-[160px]">Metric</TableHead>
            <TableHead className="text-right min-w-[90px] bg-primary/5 font-bold">TTM</TableHead>
            {financials.map((f) => (
              <TableHead key={f.period} className="text-right min-w-[90px]">
                {f.period.replace('-FY', '')}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {metricGroups.map((group) => {
            const visibleMetrics = group.metrics.filter((m) =>
              financials.some((f) => f[m.key] != null),
            );
            if (visibleMetrics.length === 0) return null;

            return (
              <GroupRows
                key={group.name}
                group={{ ...group, metrics: visibleMetrics }}
                financials={financials}
                latestFY={latestFY}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function GroupRows({
  group,
  financials,
  latestFY,
}: {
  group: MetricGroup;
  financials: FinancialData[];
  latestFY: FinancialData;
}) {
  return (
    <>
      {/* Group header */}
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell
          colSpan={financials.length + 2}
          className="sticky left-0 z-10 bg-muted/50 font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2"
        >
          {group.name}
        </TableCell>
      </TableRow>
      {group.metrics.map((m) => {
        const yoyFirst = getYoYChange(financials, m.key, 0);

        return (
          <TableRow key={m.key} className="hover:bg-accent/30">
            <TableCell className="sticky left-0 z-10 bg-card font-medium text-sm">
              {m.label}
            </TableCell>
            {/* TTM column - use latest FY as proxy */}
            <TableCell className="text-right text-sm tabular-nums bg-primary/5 font-semibold">
              {formatNumber(latestFY[m.key] as number | null, m.type)}
            </TableCell>
            {financials.map((f, i) => {
              const val = f[m.key] as number | null;
              const yoy = getYoYChange(financials, m.key, i);

              return (
                <TableCell key={f.period} className="text-right text-sm tabular-nums">
                  <span className={yoy != null ? (yoy > 0.05 ? 'text-emerald-600 dark:text-emerald-400' : yoy < -0.05 ? 'text-red-600 dark:text-red-400' : '') : ''}>
                    {formatNumber(val, m.type)}
                  </span>
                  {yoy != null && (
                    <span className="ml-1">
                      <TrendArrow change={yoy} />
                    </span>
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        );
      })}
    </>
  );
}
