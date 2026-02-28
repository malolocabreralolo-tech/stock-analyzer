'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, Tooltip, YAxis } from 'recharts';

interface EVEbitdaComparisonProps {
  currentEvEbitda: number | null;
  historicalAvg: number | null;
  sectorMedian: number | null;
  historicalValues: number[];
}

export default function EVEbitdaComparison({
  currentEvEbitda,
  historicalAvg,
  sectorMedian,
  historicalValues,
}: EVEbitdaComparisonProps) {
  if (currentEvEbitda == null) return null;

  const values = [currentEvEbitda, historicalAvg, sectorMedian].filter(
    (v): v is number => v != null && v > 0,
  );
  if (values.length === 0) return null;

  const maxVal = Math.max(...values);

  const bars: { label: string; value: number; color: string }[] = [
    { label: 'Current', value: currentEvEbitda, color: 'bg-blue-500' },
  ];
  if (historicalAvg != null) {
    bars.push({ label: 'Historical Avg', value: historicalAvg, color: 'bg-amber-500' });
  }
  if (sectorMedian != null) {
    bars.push({ label: 'Sector Median', value: sectorMedian, color: 'bg-emerald-500' });
  }

  const discountToHistorical =
    historicalAvg && historicalAvg > 0
      ? ((currentEvEbitda - historicalAvg) / historicalAvg) * 100
      : null;

  const discountToSector =
    sectorMedian && sectorMedian > 0
      ? ((currentEvEbitda - sectorMedian) / sectorMedian) * 100
      : null;

  const sparkData = historicalValues.map((v, i) => ({ idx: i, value: v }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">EV/EBITDA Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horizontal bars */}
        <div className="space-y-3">
          {bars.map((bar) => (
            <div key={bar.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{bar.label}</span>
                <span className="font-bold tabular-nums">{bar.value.toFixed(1)}x</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${bar.color} transition-all duration-500`}
                  style={{ width: `${Math.min(100, (bar.value / maxVal) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Insight text */}
        <div className="text-xs text-muted-foreground space-y-1">
          {discountToHistorical != null && (
            <p>
              Trading at{' '}
              <span className={`font-semibold ${discountToHistorical < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {Math.abs(discountToHistorical).toFixed(1)}% {discountToHistorical < 0 ? 'discount' : 'premium'}
              </span>{' '}
              to historical average
            </p>
          )}
          {discountToSector != null && (
            <p>
              Trading at{' '}
              <span className={`font-semibold ${discountToSector < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {Math.abs(discountToSector).toFixed(1)}% {discountToSector < 0 ? 'discount' : 'premium'}
              </span>{' '}
              to sector median
            </p>
          )}
        </div>

        {/* Sparkline */}
        {sparkData.length > 2 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Historical EV/EBITDA Trend
            </p>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                  <defs>
                    <linearGradient id="evGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      return (
                        <div className="rounded bg-popover px-2 py-1 text-xs shadow border border-border">
                          {(payload[0].value as number).toFixed(1)}x
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    fill="url(#evGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
