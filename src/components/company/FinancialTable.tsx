'use client';

import { FinancialData } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FinancialTableProps {
  financials: FinancialData[];
}

const formatNumber = (val: number | null, type: 'currency' | 'percent' | 'ratio' = 'currency') => {
  if (val == null) return '—';
  if (type === 'percent') return `${(val * 100).toFixed(1)}%`;
  if (type === 'ratio') return val.toFixed(2);
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toFixed(2)}`;
};

const metrics: Array<{ key: keyof FinancialData; label: string; type: 'currency' | 'percent' | 'ratio' }> = [
  { key: 'revenue', label: 'Revenue', type: 'currency' },
  { key: 'netIncome', label: 'Net Income', type: 'currency' },
  { key: 'ebitda', label: 'EBITDA', type: 'currency' },
  { key: 'freeCashFlow', label: 'Free Cash Flow', type: 'currency' },
  { key: 'eps', label: 'EPS', type: 'ratio' },
  { key: 'grossMargin', label: 'Gross Margin', type: 'percent' },
  { key: 'operatingMargin', label: 'Operating Margin', type: 'percent' },
  { key: 'netMargin', label: 'Net Margin', type: 'percent' },
  { key: 'roe', label: 'ROE', type: 'percent' },
  { key: 'roic', label: 'ROIC', type: 'percent' },
  { key: 'pe', label: 'P/E', type: 'ratio' },
  { key: 'evEbitda', label: 'EV/EBITDA', type: 'ratio' },
  { key: 'pb', label: 'P/B', type: 'ratio' },
  { key: 'debtToEquity', label: 'Debt/Equity', type: 'ratio' },
  { key: 'currentRatio', label: 'Current Ratio', type: 'ratio' },
  { key: 'revenueGrowth', label: 'Revenue Growth', type: 'percent' },
  { key: 'epsGrowth', label: 'EPS Growth', type: 'percent' },
  { key: 'dividendYield', label: 'Dividend Yield', type: 'percent' },
];

export default function FinancialTable({ financials }: FinancialTableProps) {
  if (financials.length === 0) {
    return <p className="text-muted-foreground">No financial data available</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-card min-w-[160px]">Metric</TableHead>
            {financials.map((f) => (
              <TableHead key={f.period} className="text-right min-w-[100px]">
                {f.period.replace('-FY', '')}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map((m) => {
            const hasAnyValue = financials.some((f) => f[m.key] != null);
            if (!hasAnyValue) return null;

            return (
              <TableRow key={m.key}>
                <TableCell className="sticky left-0 bg-card font-medium text-sm">
                  {m.label}
                </TableCell>
                {financials.map((f) => (
                  <TableCell key={f.period} className="text-right text-sm tabular-nums">
                    {formatNumber(f[m.key] as number | null, m.type)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
