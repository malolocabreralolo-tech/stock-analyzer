'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PortfolioPosition } from '@/types';

interface PortfolioTableProps {
  positions: PortfolioPosition[];
}

export default function PortfolioTable({ positions }: PortfolioTableProps) {
  if (positions.length === 0) {
    return <p className="text-muted-foreground">No positions in portfolio</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticker</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Sector</TableHead>
          <TableHead className="text-right">Weight</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Fair Value</TableHead>
          <TableHead className="text-right">Upside</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions.map((p) => (
          <TableRow key={p.ticker}>
            <TableCell>
              <Link href={`/company/${p.ticker}`} className="font-bold hover:underline">
                {p.ticker}
              </Link>
            </TableCell>
            <TableCell className="text-sm max-w-[200px] truncate">{p.name}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs">{p.sector}</Badge>
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {p.weight.toFixed(1)}%
            </TableCell>
            <TableCell className="text-right tabular-nums">${p.currentPrice.toFixed(2)}</TableCell>
            <TableCell className="text-right tabular-nums">${p.fairValue.toFixed(2)}</TableCell>
            <TableCell className="text-right">
              <span className={`font-bold ${p.upsidePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {p.upsidePercent >= 0 ? '+' : ''}{p.upsidePercent.toFixed(1)}%
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
