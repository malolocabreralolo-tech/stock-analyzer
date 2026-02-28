import { notFound } from 'next/navigation';
import { getCompanyData, getFinancials, getHistoricalPrices, getDynamicRatios } from '@/lib/data-sources/aggregator';
import { calculateCompositeValuation } from '@/lib/valuation/composite';
import prisma from '@/lib/db';
import PriceChart from '@/components/charts/PriceChart';
import RatioChart from '@/components/charts/RatioChart';
import ValuationGauge from '@/components/charts/ValuationGauge';
import FinancialTable from '@/components/company/FinancialTable';
import InteractiveChart from '@/components/charts/InteractiveChart';
import AIAnalysisComponent from '@/components/company/AIAnalysis';
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

  const [profile, financials, prices, dynamicRatios] = await Promise.all([
    getCompanyData(upperTicker),
    getFinancials(upperTicker),
    getHistoricalPrices(upperTicker),
    getDynamicRatios(upperTicker),
  ]);

  if (!profile) notFound();

  const valuation = calculateCompositeValuation(
    financials,
    profile.price,
    profile.sector,
    profile.marketCap,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{upperTicker}</h1>
            <Badge variant="secondary">{profile.exchange}</Badge>
          </div>
          <p className="text-lg text-muted-foreground">{profile.name}</p>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <span>{profile.sector}</span>
            <span>|</span>
            <span>{profile.industry}</span>
            <span>|</span>
            <span>Mkt Cap: {formatMarketCap(profile.marketCap)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold">${profile.price.toFixed(2)}</p>
        </div>
      </div>

      {/* Valuation Gauge */}
      <ValuationGauge valuation={valuation} />

      {/* Price Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceChart data={prices} fairValue={valuation.compositeValue} />
        </CardContent>
      </Card>

      {/* Financial Data */}
      <Tabs defaultValue="interactive">
        <TabsList>
          <TabsTrigger value="interactive">Interactive</TabsTrigger>
          <TabsTrigger value="table">Financial Table</TabsTrigger>
          <TabsTrigger value="charts">Ratio Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="interactive">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Metric Interactive Chart</CardTitle>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
