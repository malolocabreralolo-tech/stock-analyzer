import prisma from '@/lib/db';
import { seedMockData } from '@/lib/seed';
import CompanyCard from '@/components/company/CompanyCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  // Auto-seed mock data on first load
  await seedMockData();

  const companiesWithValuations = await prisma.company.findMany({
    include: {
      valuations: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
    },
    where: {
      valuations: { some: {} },
    },
  });

  const withValuation = companiesWithValuations
    .filter((c) => c.valuations.length > 0)
    .map((c) => ({
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      price: c.valuations[0].currentPrice,
      fairValue: c.valuations[0].compositeValue,
      upsidePercent: c.valuations[0].upsidePercent,
      rating: c.valuations[0].rating,
    }));

  const undervalued = [...withValuation]
    .filter((c) => c.rating === 'undervalued')
    .sort((a, b) => b.upsidePercent - a.upsidePercent)
    .slice(0, 10);

  const overvalued = [...withValuation]
    .filter((c) => c.rating === 'overvalued')
    .sort((a, b) => a.upsidePercent - b.upsidePercent)
    .slice(0, 10);

  const sectorMap: Record<string, { count: number; totalUpside: number }> = {};
  for (const c of withValuation) {
    if (!sectorMap[c.sector]) sectorMap[c.sector] = { count: 0, totalUpside: 0 };
    sectorMap[c.sector].count++;
    sectorMap[c.sector].totalUpside += c.upsidePercent;
  }
  const sectors = Object.entries(sectorMap)
    .map(([sector, data]) => ({
      sector,
      count: data.count,
      avgUpside: data.totalUpside / data.count,
    }))
    .sort((a, b) => b.avgUpside - a.avgUpside);

  return { undervalued, overvalued, sectors, totalCompanies: withValuation.length };
}

export default async function Dashboard() {
  const { undervalued, overvalued, sectors, totalCompanies } = await getDashboardData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {totalCompanies > 0
            ? `Analyzing ${totalCompanies} companies across ${sectors.length} sectors`
            : 'Search for a company ticker to get started (e.g. AAPL, MSFT, GOOGL)'}
        </p>
      </div>

      {totalCompanies === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Welcome to Stock Analyzer</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Use the search bar above to look up any US stock ticker. The app will fetch financial data,
              calculate fair value using DCF and multiples models, and optionally generate an AI analysis.
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

      {sectors.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Sector Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sectors.map((s) => (
              <Card key={s.sector}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{s.sector}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-2xl font-bold">
                        <span className={s.avgUpside >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {s.avgUpside >= 0 ? '+' : ''}{s.avgUpside.toFixed(1)}%
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">Avg. upside</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{s.count} companies</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
