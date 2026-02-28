import Link from 'next/link';
import prisma from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function getSectorSummaries() {
  const companies = await prisma.company.findMany({
    select: {
      sector: true,
      financials: {
        orderBy: { period: 'desc' },
        take: 1,
        select: { pe: true, evEbitda: true },
      },
    },
  });

  const sectorMap: Record<string, { count: number; peValues: number[]; evEbitdaValues: number[] }> = {};

  for (const c of companies) {
    if (!sectorMap[c.sector]) {
      sectorMap[c.sector] = { count: 0, peValues: [], evEbitdaValues: [] };
    }
    sectorMap[c.sector].count++;
    const f = c.financials[0];
    if (f?.pe != null && f.pe > 0 && f.pe < 100) sectorMap[c.sector].peValues.push(f.pe);
    if (f?.evEbitda != null && f.evEbitda > 0 && f.evEbitda < 100) sectorMap[c.sector].evEbitdaValues.push(f.evEbitda);
  }

  return Object.entries(sectorMap)
    .map(([sector, data]) => ({
      sector,
      count: data.count,
      medianPE: median(data.peValues),
      medianEvEbitda: median(data.evEbitdaValues),
    }))
    .sort((a, b) => b.count - a.count);
}

export default async function ComparablesIndexPage() {
  const sectors = await getSectorSummaries();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sector Comparables</h1>
        <p className="text-muted-foreground mt-1">
          {sectors.length > 0
            ? `Compare companies across ${sectors.length} sectors`
            : 'No sector data yet. Analyze some companies first.'}
        </p>
      </div>

      {sectors.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sectors.map((s) => (
            <Link key={s.sector} href={`/comparables/${encodeURIComponent(s.sector)}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{s.sector}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{s.count}</p>
                  <p className="text-xs text-muted-foreground">companies</p>
                  <div className="flex gap-4 mt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Median P/E</p>
                      <p className="font-bold tabular-nums">{s.medianPE ? s.medianPE.toFixed(1) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Median EV/EBITDA</p>
                      <p className="font-bold tabular-nums">{s.medianEvEbitda ? s.medianEvEbitda.toFixed(1) : 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
