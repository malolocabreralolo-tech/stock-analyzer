import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyData, getFinancials, getHistoricalPrices, getDynamicRatios } from '@/lib/data-sources/aggregator';
import { calculateCompositeValuation } from '@/lib/valuation/composite';
import { getSectorMultiplesFromDB } from '@/lib/valuation/sector-averages';
import prisma from '@/lib/db';
import PriceChart from '@/components/charts/PriceChart';
import RatioChart from '@/components/charts/RatioChart';
import ValuationGauge from '@/components/charts/ValuationGauge';
import FinancialTable from '@/components/company/FinancialTable';
import InteractiveChart from '@/components/charts/InteractiveChart';
import AIAnalysisComponent from '@/components/company/AIAnalysis';
import EVEbitdaComparison from '@/components/company/EVEbitdaComparison';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export default async function CompanyPage({ params }: PageProps) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  // Fetch profile + financials + prices first (critical data)
  // Dynamic ratios fetched after to avoid overwhelming Yahoo Finance API
  const [profile, financials, prices] = await Promise.all([
    getCompanyData(upperTicker),
    getFinancials(upperTicker),
    getHistoricalPrices(upperTicker),
  ]);

  // Fetch dynamic ratios separately to avoid concurrent Yahoo rate limits
  const dynamicRatios = await getDynamicRatios(upperTicker).catch(() => []);

  if (!profile) notFound();

  // Enrich profile with latest closing price from historical data if missing
  if ((!profile.price || profile.price === 0) && prices.length > 0) {
    profile.price = prices[prices.length - 1].close;
    // Estimate market cap from price if also missing
    if (!profile.marketCap || profile.marketCap === 0) {
      const company = await prisma.company.findUnique({ where: { ticker: upperTicker } });
      if (company) {
        // Update price in DB for future visits
        await prisma.company.update({
          where: { ticker: upperTicker },
          data: { price: profile.price },
        });
      }
    }
  }

  const dynamicSectorMedians = await getSectorMultiplesFromDB(profile.sector, upperTicker);

  const valuation = calculateCompositeValuation(
    financials,
    profile.price,
    profile.sector,
    profile.marketCap,
    profile.beta,
    dynamicSectorMedians,
  );

  // Save valuation to DB
  const company = await prisma.company.findUnique({ where: { ticker: upperTicker } });
  if (company) {
    await prisma.valuation.create({
      data: {
        companyId: company.id,
        currentPrice: valuation.currentPrice,
        dcfValue: valuation.dcfValue,
        multiplesValue: valuation.multiplesValue,
        compositeValue: valuation.compositeValue,
        upsidePercent: valuation.upsidePercent,
        rating: valuation.rating,
        confidence: valuation.confidence,
      },
    });
  }

  const formatMarketCap = (mc: number) => {
    if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
    if (mc >= 1e9) return `$${(mc / 1e9).toFixed(2)}B`;
    if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
    return `$${mc.toFixed(0)}`;
  };

  // Get latest financial for KPI extraction
  const latestFinancial = financials.length > 0 ? financials[0] : null;
  const pe = latestFinancial?.pe;
  const eps = latestFinancial?.eps;
  const divYield = latestFinancial?.dividendYield;

  // Calculate 52-week range from price data
  const last252 = prices.slice(-252);
  const low52 = last252.length > 0 ? Math.min(...last252.map(p => p.low)) : null;
  const high52 = last252.length > 0 ? Math.max(...last252.map(p => p.high)) : null;

  // Price change (last vs previous close)
  const lastPrice = prices.length > 0 ? prices[prices.length - 1].close : profile.price;
  const prevPrice = prices.length > 1 ? prices[prices.length - 2].close : lastPrice;
  const priceChange = lastPrice - prevPrice;
  const priceChangePct = prevPrice ? (priceChange / prevPrice) * 100 : 0;

  const ratingColor = valuation.rating === 'undervalued'
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    : valuation.rating === 'overvalued'
    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';

  const kpis = [
    { label: 'Market Cap', value: formatMarketCap(profile.marketCap) },
    { label: 'P/E Ratio', value: pe != null ? pe.toFixed(1) : 'N/A' },
    { label: 'EPS', value: eps != null ? `$${eps.toFixed(2)}` : 'N/A' },
    { label: 'Div Yield', value: divYield != null ? `${(divYield * 100).toFixed(2)}%` : 'N/A' },
    { label: '52W Range', value: low52 != null && high52 != null ? `$${low52.toFixed(0)} - $${high52.toFixed(0)}` : 'N/A' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{upperTicker}</h1>
              <Badge variant="secondary" className="font-mono text-[10px]">{profile.exchange}</Badge>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-bold uppercase ${ratingColor}`}>
                {valuation.rating}
                <span className="ml-1.5 font-mono">
                  {valuation.upsidePercent >= 0 ? '+' : ''}{valuation.upsidePercent.toFixed(1)}%
                </span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{profile.name}</p>
            <p className="text-xs text-muted-foreground">
              <Link href={`/comparables/${encodeURIComponent(profile.sector)}`} className="hover:underline">
                {profile.sector}
              </Link>
              {' '}&middot; {profile.industry}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums">${profile.price.toFixed(2)}</p>
            <p className={`text-sm font-semibold tabular-nums ${priceChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
            </p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-border">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Valuation Gauge */}
      <ValuationGauge valuation={valuation} />

      {/* EV/EBITDA Comparison */}
      <EVEbitdaComparison
        currentEvEbitda={financials[0]?.evEbitda ?? null}
        historicalAvg={valuation.details.multiples?.historicalAvgEvEbitda ?? null}
        sectorMedian={valuation.details.multiples?.sectorMedians.evEbitda ?? null}
        historicalValues={valuation.details.multiples?.historicalEvEbitdaValues ?? []}
      />

      {/* Price Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceChart data={prices} fairValue={valuation.compositeValue} />
        </CardContent>
      </Card>

      {/* Financial Data */}
      <Tabs defaultValue="interactive">
        <TabsList>
          <TabsTrigger value="interactive">Interactive</TabsTrigger>
          <TabsTrigger value="table">Financials</TabsTrigger>
          <TabsTrigger value="charts">Ratio Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="interactive">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Multi-Metric Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <InteractiveChart financials={financials} dynamicRatios={dynamicRatios} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6">
              <FinancialTable financials={financials} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <RatioChart financials={financials} metric="revenue" title="Revenue" format="currency" color="#3b82f6" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <RatioChart financials={financials} metric="netIncome" title="Net Income" format="currency" color="#22c55e" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <RatioChart financials={financials} metric="grossMargin" title="Gross Margin" format="percent" type="line" color="#8b5cf6" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <RatioChart financials={financials} metric="operatingMargin" title="Operating Margin" format="percent" type="line" color="#f59e0b" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <RatioChart financials={financials} metric="roe" title="Return on Equity (ROE)" format="percent" type="line" color="#06b6d4" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <RatioChart financials={financials} metric="pe" title="P/E Ratio" format="number" type="line" color="#ec4899" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <RatioChart financials={financials} metric="debtToEquity" title="Debt/Equity" format="number" color="#ef4444" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <RatioChart financials={financials} metric="freeCashFlow" title="Free Cash Flow" format="currency" color="#14b8a6" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* AI Analysis */}
      <AIAnalysisComponent ticker={upperTicker} />
    </div>
  );
}
