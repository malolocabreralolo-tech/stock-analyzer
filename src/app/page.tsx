import prisma from '@/lib/db';
import { seedMockData } from '@/lib/seed';
import CompanyCard from '@/components/company/CompanyCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  // Auto-seed S&P 500 company list on first load
  await seedMockData();

  // Fetch all companies (profile only) and their most recent valuation (if any)
  const allCompanies = await prisma.company.findMany({
    include: {
      valuations: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ sector: 'asc' }, { ticker: 'asc' }],
  });

  // Build sector map: sector -> list of companies (with optional valuation)
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

  // Sector summary for the overview cards
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">S&amp;P 500 Stock Analyzer</h1>
        <p className="text-muted-foreground mt-1">
          {totalCompanies > 0
            ? `${totalCompanies} companies across ${sectorSummaries.length} sectors — ${analyzedCount} analyzed`
            : 'Loading S&P 500 company list…'}
        </p>
      </div>

      {totalCompanies === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Welcome to Stock Analyzer</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              The S&amp;P 500 company list is being loaded. Refresh the page in a moment. You can
              also search for any US stock ticker above.
            </p>
          </CardContent>
        </Card>
      )}

      {undervalued.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Top Undervalued</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {undervalued.map((c) => (
              <CompanyCard key={c.ticker} {...c} />
            ))}
          </div>
        </section>
      )}

      {overvalued.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Top Overvalued</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {overvalued.map((c) => (
              <CompanyCard key={c.ticker} {...c} />
            ))}
          </div>
        </section>
      )}

      {/* Sector Overview */}
      {sectorSummaries.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Sector Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sectorSummaries.map((s) => (
              <Card key={s.sector}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{s.sector}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <div>
                      {s.avgUpside !== null ? (
                        <>
                          <p className="text-2xl font-bold">
                            <span className={s.avgUpside >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {s.avgUpside >= 0 ? '+' : ''}
                              {s.avgUpside.toFixed(1)}%
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Avg. upside ({s.analyzedCount} analyzed)
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not yet analyzed</p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{s.totalCount} companies</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* All Companies by Sector */}
      {Object.keys(sectorMap).length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">All S&amp;P 500 Companies</h2>
          <div className="space-y-6">
            {Object.entries(sectorMap)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([sector, companies]) => (
                <div key={sector}>
                  <h3 className="text-base font-semibold mb-3 text-muted-foreground border-b pb-1">
                    {sector}{' '}
                    <span className="text-sm font-normal">({companies.length} companies)</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                    {companies.map((c) => (
                      <Link
                        key={c.ticker}
                        href={`/company/${c.ticker}`}
                        className="block rounded-md border p-2 hover:bg-accent transition-colors"
                      >
                        <p className="font-mono text-sm font-bold">{c.ticker}</p>
                        <p className="text-xs text-muted-foreground truncate" title={c.name}>
                          {c.name}
                        </p>
                        {c.hasValuation && c.upsidePercent !== null && (
                          <p
                            className={`text-xs font-semibold mt-1 ${
                              c.rating === 'undervalued' ? 'text-green-600' : c.rating === 'overvalued' ? 'text-red-600' : 'text-yellow-600'
                            }`}
                          >
                            {c.upsidePercent >= 0 ? '+' : ''}
                            {c.upsidePercent.toFixed(1)}%
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
