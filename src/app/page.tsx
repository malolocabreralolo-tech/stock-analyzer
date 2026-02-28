import prisma from '@/lib/db';
import { seedMockData } from '@/lib/seed';
import CompanyCard from '@/components/company/CompanyCard';
import { Card, CardContent } from '@/components/ui/card';
import DashboardFilters from '@/components/DashboardFilters';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const GLOBAL_REGIONS = [
  { label: 'Europe', countries: ['UK', 'Germany', 'France', 'Switzerland', 'Netherlands', 'Spain', 'Italy', 'Sweden', 'Denmark', 'Finland', 'Norway', 'Ireland', 'Belgium'], flag: '🇪🇺' },
  { label: 'Asia Pacific', countries: ['Japan', 'China', 'Hong Kong', 'India', 'South Korea', 'Taiwan', 'Australia', 'Singapore'], flag: '🌏' },
  { label: 'Americas', countries: ['Canada', 'Brazil', 'Mexico'], flag: '🌎' },
  { label: 'Middle East & Other', countries: ['Saudi Arabia', 'UAE', 'Russia'], flag: '🌍' },
];

async function getDashboardData() {
  await seedMockData();

  // S&P 500 companies for the main browser
  const usCompanies = await prisma.company.findMany({
    where: { country: 'US' },
    include: {
      valuations: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ sector: 'asc' }, { ticker: 'asc' }],
  });

  // All companies with valuations for top picks (global)
  const allWithValuation = await prisma.company.findMany({
    where: { valuations: { some: {} } },
    include: {
      valuations: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
    },
  });

  // Global company counts by region
  const globalCounts = await prisma.company.groupBy({
    by: ['country'],
    where: { country: { not: 'US' } },
    _count: { country: true },
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

  for (const c of usCompanies) {
    const v = c.valuations[0] ?? null;
    const entry = {
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      price: v?.currentPrice ?? null,
      fairValue: v?.compositeValue ?? null,
      upsidePercent: v?.upsidePercent ?? null,
      rating: v?.rating ?? null,
      hasValuation: v !== null,
    };
    if (!sectorMap[c.sector]) sectorMap[c.sector] = [];
    sectorMap[c.sector].push(entry);
  }

  for (const c of allWithValuation) {
    const v = c.valuations[0];
    if (v) {
      companiesWithValuation.push({
        ticker: c.ticker,
        name: c.name,
        sector: c.sector,
        price: v.currentPrice,
        fairValue: v.compositeValue,
        upsidePercent: v.upsidePercent,
        rating: v.rating,
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
      return { sector, totalCount: companies.length, analyzedCount: withUpside.length, avgUpside };
    })
    .sort((a, b) => a.sector.localeCompare(b.sector));

  const globalTotal = globalCounts.reduce((s, r) => s + r._count.country, 0);

  return {
    sectorMap,
    sectorSummaries,
    undervalued,
    overvalued,
    totalUS: usCompanies.length,
    globalTotal,
    globalCounts,
    analyzedCount: companiesWithValuation.length,
  };
}

export default async function Dashboard() {
  const { sectorMap, sectorSummaries, undervalued, overvalued, totalUS, globalTotal, globalCounts, analyzedCount } =
    await getDashboardData();

  const sectors = Object.keys(sectorMap).sort();

  const countryMap = Object.fromEntries(globalCounts.map((r) => [r.country, r._count.country]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">S&P 500 Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalUS > 0
              ? `${totalUS} companies · ${sectorSummaries.length} sectors · ${analyzedCount} analyzed`
              : 'Loading company list…'}
          </p>
        </div>
      </div>

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
              <Link key={s.sector} href={`/comparables/${encodeURIComponent(s.sector)}`}>
                <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">{s.sector}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {s.totalCount} companies · {s.analyzedCount} analyzed
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
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* S&P 500 Company Browser */}
      {Object.keys(sectorMap).length > 0 && (
        <DashboardFilters sectorMap={sectorMap} sectors={sectors} />
      )}

      {/* Global Coverage */}
      {globalTotal > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Global Coverage</h2>
            <span className="text-xs text-muted-foreground">{globalTotal} companies across 27 countries</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {GLOBAL_REGIONS.map((region) => {
              const count = region.countries.reduce((s, c) => s + (countryMap[c] ?? 0), 0);
              const topCountries = region.countries
                .filter((c) => countryMap[c])
                .sort((a, b) => (countryMap[b] ?? 0) - (countryMap[a] ?? 0))
                .slice(0, 4);
              return (
                <Card key={region.label} className="hover:bg-accent/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{region.flag}</span>
                        <p className="text-sm font-semibold">{region.label}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{count} cos.</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {topCountries.map((country) => (
                        <span
                          key={country}
                          className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-muted"
                        >
                          {country}
                          <span className="text-muted-foreground">({countryMap[country]})</span>
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
