import prisma from '@/lib/db';
import { seedMockData } from '@/lib/seed';
import CompanyCard from '@/components/company/CompanyCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardFilters from '@/components/DashboardFilters';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  await seedMockData();

  const allCompanies = await prisma.company.findMany({
    include: {
      valuations: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ sector: 'asc' }, { ticker: 'asc' }],
  });

  const sectorMap: Record<
    string,
    {
      ticker: string;
      name: string;
      sector: string;
      price: number | null;
      fairValue: number | null;
      upsidePercent: number | null;
      rating: string | null;
      hasValuation: boolean;
    }[]
  > = {};

  const companiesWithValuation: {
    ticker: string;
    name: string;
    sector: string;
    price: number;
    fairValue: number;
    upsidePercent: number;
    rating: string;
  }[] = [];

  for (const c of allCompanies) {
    const latestValuation = c.valuations[0] ?? null;

    const entry = {
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      price: latestValuation?.currentPrice ?? null,
      fairValue: latestValuation?.compositeValue ?? null,
      upsidePercent: latestValuation?.upsidePercent ?? null,
      rating: latestValuation?.rating ?? null,
      hasValuation: latestValuation !== null,
    };

    if (!sectorMap[c.sector]) sectorMap[c.sector] = [];
    sectorMap[c.sector].push(entry);

    if (latestValuation) {
      companiesWithValuation.push({
        ticker: c.ticker,
        name: c.name,
        sector: c.sector,
        price: latestValuation.currentPrice,
        fairValue: latestValuation.compositeValue,
        upsidePercent: latestValuation.upsidePercent,
        rating: latestValuation.rating,
      });
    }
  }

  const undervalued = [...companiesWithValuation]
    .filter((c) => c.rating === 'undervalued')
    .sort((a, b) => b.upsidePercent - a.upsidePercent)
    .slice(0, 10);

  const overvalued = [...companiesWithValuation]
    .filter((c) => c.rating === 'overvalued')
    .sort((a, b) => a.upsidePercent - b.upsidePercent)
    .slice(0, 10);

  const sectorSummaries = Object.entries(sectorMap)
    .map(([sector, companies]) => {
      const withUpside = companies.filter((c) => c.upsidePercent !== null);
      const avgUpside =
        withUpside.length > 0
          ? withUpside.reduce((sum, c) => sum + (c.upsidePercent ?? 0), 0) / withUpside.length
          : null;
      return {
        sector,
        totalCount: companies.length,
        analyzedCount: withUpside.length,
        avgUpside,
      };
    })
    .sort((a, b) => a.sector.localeCompare(b.sector));

  return {
    sectorMap,
    sectorSummaries,
    undervalued,
    overvalued,
    totalCompanies: allCompanies.length,
    analyzedCount: companiesWithValuation.length,
  };
}

export default async function Dashboard() {
  const { sectorMap, sectorSummaries, undervalued, overvalued, totalCompanies, analyzedCount } =
    await getDashboardData();

  const sectors = Object.keys(sectorMap).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">S&P 500 Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalCompanies > 0
              ? `${totalCompanies} companies \u00b7 ${sectorSummaries.length} sectors \u00b7 ${analyzedCount} analyzed`
              : 'Loading S&P 500 company list\u2026'}
          </p>
        </div>
      </div>

      {totalCompanies === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-lg font-semibold mb-2">Welcome to Stock Analyzer</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              The S&P 500 company list is being loaded. Refresh the page in a moment. You can
              also search for any US stock ticker above.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top Undervalued */}
      {undervalued.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Top Undervalued
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {undervalued.map((c) => (
              <CompanyCard key={c.ticker} {...c} />
            ))}
          </div>
        </section>
      )}

      {/* Top Overvalued */}
      {overvalued.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Top Overvalued
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {overvalued.map((c) => (
              <CompanyCard key={c.ticker} {...c} />
            ))}
          </div>
        </section>
      )}

      {/* Sector Overview */}
      {sectorSummaries.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Sector Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sectorSummaries.map((s) => (
              <Card key={s.sector} className="hover:bg-accent/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{s.sector}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {s.totalCount} companies &middot; {s.analyzedCount} analyzed
                      </p>
                    </div>
                    {s.avgUpside !== null && (
                      <span className={`text-lg font-bold tabular-nums ${
                        s.avgUpside >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {s.avgUpside >= 0 ? '+' : ''}{s.avgUpside.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {s.avgUpside !== null && (
                    <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.avgUpside >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, Math.abs(s.avgUpside) * 2)}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* All Companies with Filters */}
      {Object.keys(sectorMap).length > 0 && (
        <DashboardFilters sectorMap={sectorMap} sectors={sectors} />
      )}
    </div>
  );
}
