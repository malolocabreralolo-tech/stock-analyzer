'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
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
  const ratingVariant = rating === 'undervalued' ? 'default' : rating === 'overvalued' ? 'destructive' : 'secondary';

  return (
    <Link href={`/company/${ticker}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-bold text-base">{ticker}</h3>
              <p className="text-sm text-muted-foreground truncate max-w-[180px]">{name}</p>
            </div>
            <Badge variant={ratingVariant} className="text-xs capitalize">
              {rating}
            </Badge>
          </div>

          <div className="flex items-end justify-between mt-3">
            <div>
              <p className="text-xs text-muted-foreground">Price</p>
              <p className="text-lg font-semibold">${price.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Fair Value</p>
              <p className="text-lg font-semibold">${fairValue.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{sector}</span>
            <span className={`text-sm font-bold ${upsidePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {upsidePercent >= 0 ? '+' : ''}{upsidePercent.toFixed(1)}%
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
