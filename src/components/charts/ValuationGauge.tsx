'use client';

import { ValuationResult } from '@/types';

interface ValuationGaugeProps {
  valuation: ValuationResult;
}

export default function ValuationGauge({ valuation }: ValuationGaugeProps) {
  const { currentPrice, compositeValue, upsidePercent, rating, confidence, dcfValue, multiplesValue } = valuation;

  // Gauge: map upside from -60% to +60% → 0° to 180°
  const clampedUpside = Math.max(-60, Math.min(60, upsidePercent));
  const angle = ((clampedUpside + 60) / 120) * 180;
  const angleRad = (angle * Math.PI) / 180;

  // SVG arc parameters
  const cx = 150;
  const cy = 130;
  const r = 100;

  // Needle endpoint
  const needleX = cx - r * Math.cos(angleRad);
  const needleY = cy - r * Math.sin(angleRad);

  const ratingStyles = {
    undervalued: { badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', glow: 'shadow-emerald-500/10' },
    fair: { badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30', glow: 'shadow-amber-500/10' },
    overvalued: { badge: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30', glow: 'shadow-red-500/10' },
  };
  const styles = ratingStyles[rating];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Gauge */}
        <div className="flex flex-col items-center">
          <svg width="300" height="160" viewBox="0 0 300 160" className="max-w-full">
            <defs>
              <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="75%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            {/* Background arc */}
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="18"
              strokeLinecap="round"
              className="text-muted/30"
            />
            {/* Colored arc */}
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
              fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth="18"
              strokeLinecap="round"
            />
            {/* Tick marks */}
            {[0, 45, 90, 135, 180].map((a) => {
              const rad = (a * Math.PI) / 180;
              const x1 = cx - (r - 14) * Math.cos(rad);
              const y1 = cy - (r - 14) * Math.sin(rad);
              const x2 = cx - (r + 14) * Math.cos(rad);
              const y2 = cy - (r + 14) * Math.sin(rad);
              return (
                <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
              );
            })}
            {/* Labels */}
            <text x={cx - r - 8} y={cy + 18} textAnchor="middle" className="fill-muted-foreground text-[9px]">-60%</text>
            <text x={cx} y={cy - r - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">0%</text>
            <text x={cx + r + 8} y={cy + 18} textAnchor="middle" className="fill-muted-foreground text-[9px]">+60%</text>
            {/* Needle */}
            <line
              x1={cx}
              y1={cy}
              x2={needleX}
              y2={needleY}
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-foreground"
            />
            <circle cx={cx} cy={cy} r="5" className="fill-foreground" />
            <circle cx={cx} cy={cy} r="2.5" className="fill-card" />
            {/* Center value */}
            <text x={cx} y={cy + 35} textAnchor="middle" className="fill-foreground font-bold text-base">
              {upsidePercent >= 0 ? '+' : ''}{upsidePercent.toFixed(1)}%
            </text>
            <text x={cx} y={cy + 48} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              upside potential
            </text>
          </svg>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Current Price</p>
              <p className="text-xl font-bold tabular-nums">${currentPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Fair Value</p>
              <p className="text-xl font-bold tabular-nums">${compositeValue.toFixed(2)}</p>
            </div>
          </div>

          {/* DCF vs Multiples breakdown */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">DCF Value</p>
              <p className="text-base font-bold tabular-nums">
                {dcfValue ? `$${dcfValue.toFixed(2)}` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Multiples Value</p>
              <p className="text-base font-bold tabular-nums">
                {multiplesValue ? `$${multiplesValue.toFixed(2)}` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Confidence */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Confidence</p>
              <p className="text-xs font-bold tabular-nums">{((confidence || 0) * 100).toFixed(0)}%</p>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(confidence || 0) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
