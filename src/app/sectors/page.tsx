import prisma from '@/lib/db';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

async function getSectorData() {
  const companies = await prisma.company.findMany({
    include: {
      valuations: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
      financials: {
        orderBy: { period: 'desc' },
        take: 1,
      },
    },
    where: {
      valuations: { some: {} },
    },
  });

  const sectorMap: Record<string, Array<{
    ticker: string;
    name: string;
    price: number;
    fairValue: number;
    upside: number;
    rating: string;
    pe: number | null;
    roe: number | null;
    marketCap: number;
  }>> = {};

  for (const c of companies) {
    const v = c.valuations[0];
    const f = c.financials[0];
    if (!v) continue;

    if (!sectorMap[c.sector]) sectorMap[c.sector] = [];
    sectorMap[c.sector].push({
      ticker: c.ticker,
      name: c.name,
      price: v.currentPrice,
      fairValue: v.compositeValue,
      upside: v.upsidePercent,
      rating: v.rating,
      pe: f?.pe ?? null,
      roe: f?.roe ?? null,
      marketCap: c.marketCap || 0,
    });
  }

  return Object.entries(sectorMap)
    .map(([sector, companies]) => ({
      sector,
      companies: companies.sort((a, b) => b.upside - a.upside),
      avgUpside: companies.reduce((s, c) => s + c.upside, 0) / companies.length,
      avgPE: companies.filter((c) => c.pe).length > 0
        ? companies.filter((c) => c.pe).reduce((s, c) => s + c.pe!, 0) / companies.filter((c) => c.pe).length
        : null,
    }))
    .sort((a, b) => b.avgUpside - a.avgUpside);
}

export default async function SectorsPage() {
  const sectors = await getSectorData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sector Analysis</h1>
        <p className="text-muted-foreground mt-1">
          {sectors.length > 0
            ? `Comparing ${sectors.length} sectors`
            : 'No sector data yet. Analyze some companies first.'}
        </p>
      </div>

      {/* Sector heatmap cards */}
      {sectors.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sectors.map((s) => {
            const intensity = Math.min(1, Math.abs(s.avgUpside) / 50);
            const bgColor = s.avgUpside >= 0
              ? `rgba(34, 197, 94, ${intensity * 0.2})`
              : `rgba(239, 68, 68, ${intensity * 0.2})`;

            return (
              <Card key={s.sector} style={{ backgroundColor: bgColor }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{s.sector}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${s.avgUpside >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {s.avgUpside >= 0 ? '+' : ''}{s.avgUpside.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {s.companies.length} companies | Avg P/E: {s.avgPE ? s.avgPE.toFixed(1) : 'N/A'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detailed sector tables */}
      {sectors.map((s) => (
        <Card key={s.sector}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{s.sector}</CardTitle>
              <Badge variant={s.avgUpside >= 0 ? 'default' : 'destructive'}>
                Avg: {s.avgUpside >= 0 ? '+' : ''}{s.avgUpside.toFixed(1)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Fair Value</TableHead>
                  <TableHead className="text-right">Upside</TableHead>
                  <TableHead className="text-right">P/E</TableHead>
                  <TableHead className="text-right">ROE</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.companies.map((c) => (
                  <TableRow key={c.ticker}>
                    <TableCell>
                      <Link href={`/company/${c.ticker}`} className="font-bold hover:underline">
                        {c.ticker}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{c.name}</TableCell>
                    <TableCell className="text-right tabular-nums">${c.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">${c.fairValue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold ${c.upside >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {c.upside >= 0 ? '+' : ''}{c.upside.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.pe ? c.pe.toFixed(1) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.roe ? `${(c.roe * 100).toFixed(1)}%` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.rating === 'undervalued' ? 'default' : c.rating === 'overvalued' ? 'destructive' : 'secondary'}
                        className="text-xs capitalize"
                      >
                        {c.rating}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
