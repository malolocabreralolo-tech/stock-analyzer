/* eslint-disable @typescript-eslint/no-explicit-any */
import YahooFinance from 'yahoo-finance2';
import { CompanyProfile, FinancialData, HistoricalPrice } from '@/types';

const yf = new YahooFinance();

export async function getYahooV2Profile(ticker: string): Promise<CompanyProfile | null> {
  try {
    const result: any = await yf.quoteSummary(ticker, {
      modules: ['price', 'summaryDetail', 'assetProfile', 'quoteType'],
    });

    const price = result.price;
    const profile = result.assetProfile;
    const quoteType = result.quoteType;

    return {
      ticker,
      name: quoteType?.longName || price?.longName || ticker,
      sector: profile?.sector || 'Unknown',
      industry: profile?.industry || 'Unknown',
      marketCap: price?.marketCap || 0,
      exchange: price?.exchangeName || 'UNKNOWN',
      price: price?.regularMarketPrice || 0,
    };
  } catch (e) {
    console.error(`[yahoo-v2] Failed to fetch profile for ${ticker}:`, e);
    return null;
  }
}

export async function getYahooV2Financials(ticker: string): Promise<FinancialData[]> {
  try {
    // Use fundamentalsTimeSeries (income statement history modules are deprecated since Nov 2024)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const [allData, summary]: [any[], any] = await Promise.all([
      yf.fundamentalsTimeSeries(ticker, {
        period1: fiveYearsAgo,
        type: 'annual',
        module: 'all',
      }),
      yf.quoteSummary(ticker, {
        modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail'],
      }),
    ]);

    if (!allData || allData.length === 0) return [];

    const keyStats = summary?.defaultKeyStatistics;
    const finData = summary?.financialData;
    const summaryDetail = summary?.summaryDetail;

    // Sort by date descending (most recent first)
    const sorted = [...allData].sort((a: any, b: any) => {
      const da = a.date instanceof Date ? a.date.getTime() : 0;
      const db = b.date instanceof Date ? b.date.getTime() : 0;
      return db - da;
    });

    const financials: FinancialData[] = sorted.map((row: any, i: number) => {
      const date = row.date instanceof Date ? row.date : new Date(row.date);
      const year = date.getFullYear();

      const revenue = safeNum(row.totalRevenue);
      const netIncome = safeNum(row.netIncome);
      const ebitda = safeNum(row.EBITDA) ?? safeNum(row.normalizedEBITDA);
      const grossProfit = safeNum(row.grossProfit);
      const operatingIncome = safeNum(row.operatingIncome);
      const totalDebt = safeNum(row.totalDebt);
      const totalEquity = safeNum(row.stockholdersEquity) ?? safeNum(row.commonStockEquity);
      const totalAssets = safeNum(row.totalAssets);
      const operatingCashFlow = safeNum(row.operatingCashFlow);
      const capitalExpenditure = safeNum(row.capitalExpenditure);
      const fcf = safeNum(row.freeCashFlow) ?? (
        operatingCashFlow != null && capitalExpenditure != null
          ? operatingCashFlow + capitalExpenditure
          : null
      );

      const grossMargin = revenue && grossProfit ? grossProfit / revenue : null;
      const operatingMargin = revenue && operatingIncome ? operatingIncome / revenue : null;
      const netMargin = revenue && netIncome ? netIncome / revenue : null;
      const roe = totalEquity && netIncome ? netIncome / totalEquity : null;
      const debtToEquity = totalEquity && totalDebt ? totalDebt / totalEquity : null;

      // Only apply current valuation ratios to most recent year
      const pe = i === 0 ? safeNum(summaryDetail?.trailingPE) : null;
      const evEbitda = i === 0 ? safeNum(keyStats?.enterpriseToEbitda) : null;
      const pb = i === 0 ? safeNum(keyStats?.priceToBook) : null;
      const ps = i === 0 && revenue
        ? ((finData?.currentPrice || 0) * (keyStats?.sharesOutstanding || 0)) / revenue
        : null;

      return {
        period: `${year}-FY`,
        periodDate: date.toISOString(),
        revenue,
        netIncome,
        ebitda,
        eps: safeNum(row.dilutedEPS) ?? safeNum(row.basicEPS),
        freeCashFlow: fcf,
        operatingCashFlow,
        capitalExpenditure,
        totalDebt,
        totalEquity,
        totalAssets,
        bookValuePerShare: i === 0 ? safeNum(keyStats?.bookValue) : null,
        pe,
        evEbitda,
        pb,
        ps,
        roe,
        roic: null,
        debtToEquity,
        currentRatio: i === 0 ? safeNum(finData?.currentRatio) : null,
        grossMargin,
        operatingMargin,
        netMargin,
        revenueGrowth: null,
        epsGrowth: null,
        dividendYield: i === 0 ? safeNum(summaryDetail?.dividendYield) : null,
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

    return financials;
  } catch (e) {
    console.error(`[yahoo-v2] Failed to fetch financials for ${ticker}:`, e);
    return [];
  }
}

export async function getYahooV2HistoricalPrices(ticker: string): Promise<HistoricalPrice[]> {
  try {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const result: any = await yf.chart(ticker, {
      period1: fiveYearsAgo,
      interval: '1d',
    });

    if (!result?.quotes || result.quotes.length === 0) return [];

    return result.quotes
      .filter((q: any) => q.close != null && q.close > 0)
      .map((q: any) => ({
        date: q.date instanceof Date ? q.date.toISOString().split('T')[0] : String(q.date).split('T')[0],
        open: q.open || 0,
        high: q.high || 0,
        low: q.low || 0,
        close: q.close || 0,
        volume: q.volume || 0,
      }));
  } catch (e) {
    console.error(`[yahoo-v2] Failed to fetch historical prices for ${ticker}:`, e);
    return [];
  }
}

export async function searchYahooV2(query: string): Promise<Array<{ symbol: string; name: string }>> {
  try {
    const result: any = await yf.search(query);
    return (result.quotes || [])
      .filter((q: any) => q.symbol && typeof q.symbol === 'string')
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.longname || q.shortname || q.symbol,
      }));
  } catch {
    return [];
  }
}

function safeNum(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return isFinite(n) ? n : null;
}
