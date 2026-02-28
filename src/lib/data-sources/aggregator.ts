import prisma from '@/lib/db';
import { CompanyProfile, DynamicRatioPoint, FinancialData, HistoricalPrice } from '@/types';
import * as fmp from './fmp';
import * as yahoo from './yahoo';
import * as yahooV2 from './yahoo-v2';
import * as edgar from './edgar';
import * as mock from './mock';
import { getSP500FromWikipedia } from './sp500-wiki';

const CACHE_TTL_HOURS = 24;

function useMockData(): boolean {
  return !process.env.FMP_API_KEY || process.env.FMP_API_KEY === 'your_fmp_api_key_here';
}

function isCacheStale(date: Date): boolean {
  const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  return hours > CACHE_TTL_HOURS;
}

export async function getCompanyData(ticker: string): Promise<CompanyProfile | null> {
  // Check cache
  const cached = await prisma.company.findUnique({ where: { ticker } });
  const hasFreshRealData = cached && cached.price && cached.price > 0 && !isCacheStale(cached.updatedAt);
  if (hasFreshRealData) {
    return {
      ticker: cached.ticker,
      name: cached.name,
      sector: cached.sector,
      industry: cached.industry,
      marketCap: cached.marketCap || 0,
      exchange: cached.exchange,
      price: cached.price!,
    };
  }

  let profile: CompanyProfile | null = null;

  if (useMockData()) {
    // Try yahoo-finance2 first for real data, then fall back to mock
    profile = await yahooV2.getYahooV2Profile(ticker);
    if (!profile) {
      profile = mock.getMockProfile(ticker);
    }
  } else {
    profile = await fmp.getCompanyProfile(ticker);
    if (!profile) {
      profile = await yahoo.getYahooProfile(ticker);
    }
  }

  // Fall back to cached DB record if fresh fetch fails
  if (!profile && cached) {
    return {
      ticker: cached.ticker,
      name: cached.name,
      sector: cached.sector,
      industry: cached.industry,
      marketCap: cached.marketCap || 0,
      exchange: cached.exchange,
      price: cached.price || 0,
    };
  }

  if (!profile) return null;

  // Upsert into DB
  await prisma.company.upsert({
    where: { ticker },
    update: {
      name: profile.name,
      sector: profile.sector,
      industry: profile.industry,
      marketCap: profile.marketCap,
      exchange: profile.exchange,
      price: profile.price,
    },
    create: {
      ticker: profile.ticker,
      name: profile.name,
      sector: profile.sector,
      industry: profile.industry,
      marketCap: profile.marketCap,
      exchange: profile.exchange,
      price: profile.price,
    },
  });

  return profile;
}

export async function getFinancials(ticker: string): Promise<FinancialData[]> {
  // Check cache
  const company = await prisma.company.findUnique({
    where: { ticker },
    include: { financials: { orderBy: { period: 'desc' } } },
  });

  if (company?.financials && company.financials.length > 0) {
    const newest = company.financials[0];
    const hasRealData = company.financials.some((f) => f.pe != null || f.eps != null || f.revenue != null);
    if (hasRealData && !isCacheStale(newest.fetchedAt)) {
      return company.financials.map(mapFinancialFromDB);
    }
  }

  let financials: FinancialData[];

  if (useMockData()) {
    // Fetch EDGAR and Yahoo in parallel for speed
    const [edgarFinancials, yahooFinancials] = await Promise.all([
      edgar.getEdgarFinancials(ticker).catch(() => [] as FinancialData[]),
      yahooV2.getYahooV2Financials(ticker).catch(() => [] as FinancialData[]),
    ]);

    if (edgarFinancials.length === 0 && yahooFinancials.length === 0) {
      financials = mock.getMockFinancials(ticker);
    } else {
      // Merge: EDGAR as base, overlay Yahoo data for any overlapping or more recent periods
      // Yahoo may have more accurate/recent data for the current fiscal year
      const mergedMap = new Map<string, FinancialData>();

      // Add EDGAR data first (older, longer history)
      for (const f of edgarFinancials) {
        mergedMap.set(f.period, f);
      }

      // Overlay Yahoo data (may have more recent or more accurate current-year data)
      for (const f of yahooFinancials) {
        mergedMap.set(f.period, f);
      }

      financials = Array.from(mergedMap.values()).sort((a, b) =>
        (b.periodDate ?? b.period).localeCompare(a.periodDate ?? a.period)
      );

      if (financials.length === 0) {
        financials = mock.getMockFinancials(ticker);
      }
    }
  } else {
    // Fetch fresh data from FMP
    const [incomeData, balanceData, cashFlowData, ratiosData, metricsData] = await Promise.all([
      fmp.getIncomeStatement(ticker),
      fmp.getBalanceSheet(ticker),
      fmp.getCashFlowStatement(ticker),
      fmp.getRatios(ticker),
      fmp.getKeyMetrics(ticker),
    ]);

    // Merge data by year
    financials = incomeData.map((income, i) => {
      const balance = balanceData[i] || {};
      const cashFlow = cashFlowData[i] || {};
      const ratios = ratiosData[i] || {};
      const metrics = metricsData[i] || {};

      return {
        ...income,
        freeCashFlow: (cashFlow.freeCashFlow as number) || null,
        operatingCashFlow: (cashFlow.operatingCashFlow as number) || null,
        capitalExpenditure: (cashFlow.capitalExpenditure as number) || null,
        totalDebt: (balance.totalDebt as number) || null,
        totalEquity: (balance.totalStockholdersEquity as number) || null,
        totalAssets: (balance.totalAssets as number) || null,
        bookValuePerShare: (metrics.bookValuePerShare as number) || null,
        pe: (ratios.priceEarningsRatio as number) || (metrics.peRatio as number) || null,
        evEbitda: (metrics.enterpriseValueOverEBITDA as number) || null,
        pb: (ratios.priceToBookRatio as number) || (metrics.pbRatio as number) || null,
        ps: (ratios.priceToSalesRatio as number) || (metrics.priceToSalesRatio as number) || null,
        roe: (ratios.returnOnEquity as number) || (metrics.roe as number) || null,
        roic: (ratios.returnOnCapitalEmployed as number) || (metrics.roic as number) || null,
        debtToEquity: (ratios.debtEquityRatio as number) || null,
        currentRatio: (ratios.currentRatio as number) || null,
        dividendYield: (ratios.dividendYield as number) || (metrics.dividendYield as number) || null,
      };
    });

    // Calculate growth rates
    for (let i = 0; i < financials.length - 1; i++) {
      const current = financials[i];
      const previous = financials[i + 1];
      if (current.revenue && previous.revenue && previous.revenue !== 0) {
        current.revenueGrowth = (current.revenue - previous.revenue) / Math.abs(previous.revenue);
      }
      if (current.eps && previous.eps && previous.eps !== 0) {
        current.epsGrowth = (current.eps - previous.eps) / Math.abs(previous.eps);
      }
    }
  }

  // Cache in DB
  const companyRecord = await prisma.company.findUnique({ where: { ticker } });
  if (companyRecord) {
    for (const fin of financials) {
      await prisma.financial.upsert({
        where: {
          companyId_period: { companyId: companyRecord.id, period: fin.period },
        },
        update: mapFinancialToDB(fin),
        create: {
          companyId: companyRecord.id,
          ...mapFinancialToDB(fin),
          source: useMockData() ? 'yahoo' : 'fmp',
        },
      });
    }
  }

  return financials;
}

export async function getHistoricalPrices(ticker: string): Promise<HistoricalPrice[]> {
  if (useMockData()) {
    // Try yahoo-finance2 first for real data, then fall back to mock
    const yahooV2Prices = await yahooV2.getYahooV2HistoricalPrices(ticker);
    if (yahooV2Prices.length > 0) return yahooV2Prices;
    return mock.getMockHistoricalPrices(ticker);
  }

  const from = '2000-01-01';
  const to = new Date().toISOString().split('T')[0];

  let prices = await fmp.getHistoricalPrice(ticker, from, to);
  if (prices.length === 0) {
    prices = await yahoo.getYahooHistoricalPrice(ticker);
  }
  return prices;
}

export async function searchCompanies(query: string) {
  if (useMockData()) {
    // Try yahoo-finance2 first, then fall back to mock
    const yahooResults = await yahooV2.searchYahooV2(query);
    if (yahooResults.length > 0) {
      return yahooResults.map((r) => ({ symbol: r.symbol, name: r.name }));
    }
    return mock.searchMockCompanies(query);
  }
  return fmp.searchCompany(query);
}

export async function getDynamicRatios(ticker: string): Promise<DynamicRatioPoint[]> {
  // Try EDGAR first (longer history ~15 years), fall back to Yahoo
  try {
    const edgarRatios = await edgar.getEdgarDynamicRatios(ticker);
    if (edgarRatios.length > 0) return edgarRatios;
  } catch (e) {
    console.error(`[aggregator] EDGAR dynamic ratios failed for ${ticker}:`, e);
  }
  try {
    return await yahooV2.getYahooV2DynamicRatios(ticker);
  } catch {
    return [];
  }
}

export async function getAllMockCompanies() {
  return mock.getMockCompanies();
}

export async function getSP500() {
  if (useMockData()) {
    // Use Wikipedia scraper for real S&P 500 data when FMP key is not configured
    try {
      const wikiCompanies = await getSP500FromWikipedia();
      return wikiCompanies.map((c) => ({
        symbol: c.symbol,
        name: c.name,
        sector: c.sector,
        subIndustry: c.subIndustry,
      }));
    } catch (err) {
      console.warn('Wikipedia S&P 500 scrape failed, falling back to mock data:', err);
      return mock.getMockCompanies().map((c) => ({ symbol: c.ticker, name: c.name, sector: c.sector, subIndustry: '' }));
    }
  }
  return fmp.getSP500List();
}

function mapFinancialFromDB(f: Record<string, unknown>): FinancialData {
  return {
    period: f.period as string,
    periodDate: f.periodDate ? (f.periodDate as Date).toISOString() : undefined,
    revenue: f.revenue as number | null,
    netIncome: f.netIncome as number | null,
    freeCashFlow: f.freeCashFlow as number | null,
    totalDebt: f.totalDebt as number | null,
    totalEquity: f.totalEquity as number | null,
    totalAssets: f.totalAssets as number | null,
    pe: f.pe as number | null,
    evEbitda: f.evEbitda as number | null,
    pb: f.pb as number | null,
    ps: f.ps as number | null,
    roe: f.roe as number | null,
    roic: f.roic as number | null,
    debtToEquity: f.debtToEquity as number | null,
    currentRatio: f.currentRatio as number | null,
    grossMargin: f.grossMargin as number | null,
    operatingMargin: f.operatingMargin as number | null,
    netMargin: f.netMargin as number | null,
    revenueGrowth: f.revenueGrowth as number | null,
    epsGrowth: f.epsGrowth as number | null,
    dividendYield: f.dividendYield as number | null,
    ebitda: f.ebitda as number | null,
    eps: f.eps as number | null,
    bookValuePerShare: f.bookValuePerShare as number | null,
    operatingCashFlow: f.operatingCashFlow as number | null,
    capitalExpenditure: f.capitalExpenditure as number | null,
  };
}

function mapFinancialToDB(f: FinancialData) {
  return {
    period: f.period,
    periodDate: f.periodDate ? new Date(f.periodDate) : null,
    revenue: f.revenue,
    netIncome: f.netIncome,
    freeCashFlow: f.freeCashFlow,
    totalDebt: f.totalDebt,
    totalEquity: f.totalEquity,
    totalAssets: f.totalAssets,
    pe: f.pe,
    evEbitda: f.evEbitda,
    pb: f.pb,
    ps: f.ps,
    roe: f.roe,
    roic: f.roic,
    debtToEquity: f.debtToEquity,
    currentRatio: f.currentRatio,
    grossMargin: f.grossMargin,
    operatingMargin: f.operatingMargin,
    netMargin: f.netMargin,
    revenueGrowth: f.revenueGrowth,
    epsGrowth: f.epsGrowth,
    dividendYield: f.dividendYield,
    ebitda: f.ebitda,
    eps: f.eps,
    bookValuePerShare: f.bookValuePerShare,
    operatingCashFlow: f.operatingCashFlow,
    capitalExpenditure: f.capitalExpenditure,
  };
}
