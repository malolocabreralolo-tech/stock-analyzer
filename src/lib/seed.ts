import prisma from './db';
import { getMockCompanies, getMockFinancials } from './data-sources/mock';
import { calculateCompositeValuation } from './valuation/composite';

export async function seedMockData() {
  const existingCount = await prisma.company.count();
  if (existingCount > 0) return; // Already seeded

  console.log('Seeding mock data...');
  const companies = getMockCompanies();

  for (const profile of companies) {
    // Create company
    const company = await prisma.company.create({
      data: {
        ticker: profile.ticker,
        name: profile.name,
        sector: profile.sector,
        industry: profile.industry,
        marketCap: profile.marketCap,
        exchange: profile.exchange,
        price: profile.price,
      },
    });

    // Add financials
    const financials = getMockFinancials(profile.ticker);
    for (const fin of financials) {
      await prisma.financial.create({
        data: {
          companyId: company.id,
          period: fin.period,
          periodDate: fin.periodDate ? new Date(fin.periodDate) : null,
          revenue: fin.revenue,
          netIncome: fin.netIncome,
          freeCashFlow: fin.freeCashFlow,
          totalDebt: fin.totalDebt,
          totalEquity: fin.totalEquity,
          totalAssets: fin.totalAssets,
          pe: fin.pe,
          evEbitda: fin.evEbitda,
          pb: fin.pb,
          ps: fin.ps,
          roe: fin.roe,
          roic: fin.roic,
          debtToEquity: fin.debtToEquity,
          currentRatio: fin.currentRatio,
          grossMargin: fin.grossMargin,
          operatingMargin: fin.operatingMargin,
          netMargin: fin.netMargin,
          revenueGrowth: fin.revenueGrowth,
          epsGrowth: fin.epsGrowth,
          dividendYield: fin.dividendYield,
          ebitda: fin.ebitda,
          eps: fin.eps,
          bookValuePerShare: fin.bookValuePerShare,
          operatingCashFlow: fin.operatingCashFlow,
          capitalExpenditure: fin.capitalExpenditure,
          source: 'mock',
        },
      });
    }

    // Calculate and save valuation
    const valuation = calculateCompositeValuation(
      financials,
      profile.price,
      profile.sector,
      profile.marketCap,
    );

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

  console.log(`Seeded ${companies.length} companies with financials and valuations.`);
}
