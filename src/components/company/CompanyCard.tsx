'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

interface CompanyCardProps {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  fairValue: number;
  upsidePercent: number;
  rating: string;
}

export default function CompanyCard({
  ticker,
  name,
  sector,
  price,
  fairValue,
  upsidePercent,
  rating,
}: CompanyCardProps) {
  const ratingColor = rating === 'undervalued'
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    : rating === 'overvalued'
    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';

  return (
    <Link href={`/company/${ticker}`}>
      <Card className="hover:bg-accent/50 hover:border-primary/30 transition-colors cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-mono font-bold text-base">{ticker}</h3>
              <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{name}</p>
            </div>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${ratingColor}`}>
              {rating}
            </span>
          </div>

          <div className="flex items-end justify-between mt-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Price</p>
              <p className="text-base font-semibold tabular-nums">${price.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase">Fair Value</p>
              <p className="text-base font-semibold tabular-nums">${fairValue.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground">{sector}</span>
            <span className={`text-sm font-bold tabular-nums ${
              upsidePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {upsidePercent >= 0 ? '+' : ''}{upsidePercent.toFixed(1)}%
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
