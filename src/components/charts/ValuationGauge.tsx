'use client';

import { ValuationResult } from '@/types';

interface ValuationGaugeProps {
  valuation: ValuationResult;
}

export default function ValuationGauge({ valuation }: ValuationGaugeProps) {
  const { currentPrice, compositeValue, upsidePercent, rating, confidence } = valuation;

  const ratingColors = {
    undervalued: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500' },
    fair: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-500' },
    overvalued: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500' },
  };

  const colors = ratingColors[rating];

  // Gauge position: map upside from -50% to +50% -> 0 to 100
  const gaugePosition = Math.max(0, Math.min(100, 50 + upsidePercent));

  return (
    <div className={`rounded-xl p-6 ${colors.bg} border ${colors.border}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Valuation</h3>
        <span className={`text-sm font-bold uppercase ${colors.text}`}>{rating}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Current Price</p>
          <p className="text-2xl font-bold">${currentPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Fair Value</p>
          <p className="text-2xl font-bold">${compositeValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Gauge bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Overvalued</span>
          <span>Fair</span>
          <span>Undervalued</span>
        </div>
        <div className="h-3 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full relative">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-foreground rounded-full shadow"
            style={{ left: `${gaugePosition}%`, transform: 'translate(-50%, -50%)' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Upside</p>
          <p className={`text-lg font-bold ${upsidePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {upsidePercent >= 0 ? '+' : ''}{upsidePercent.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">DCF Value</p>
          <p className="text-lg font-bold">
            {valuation.dcfValue ? `$${valuation.dcfValue.toFixed(2)}` : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Confidence</p>
          <p className="text-lg font-bold">{((confidence || 0) * 100).toFixed(0)}%</p>
        </div>
      </div>
    </div>
  );
}
