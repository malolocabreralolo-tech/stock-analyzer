import { CompanyProfile, FinancialData, HistoricalPrice } from '@/types';

const BASE_URL = 'https://financialmodelingprep.com/api/v3';
const API_KEY = process.env.FMP_API_KEY || '';

async function fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('apikey', API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FMP API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function getCompanyProfile(ticker: string): Promise<CompanyProfile | null> {
  try {
    const data = await fmpFetch<Array<{
      symbol: string; companyName: string; sector: string; industry: string;
      mktCap: number; exchangeShortName: string; price: number; description: string;
      website: string; ceo: string; fullTimeEmployees: string; country: string;
      ipoDate: string; image: string; beta: number;
    }>>(`/profile/${ticker}`);
    if (!data || data.length === 0) return null;
    const d = data[0];
    return {
      ticker: d.symbol,
      name: d.companyName,
      sector: d.sector || 'Unknown',
      industry: d.industry || 'Unknown',
      marketCap: d.mktCap,
      exchange: d.exchangeShortName,
      price: d.price,
      description: d.description,
      website: d.website,
      ceo: d.ceo,
      employees: parseInt(d.fullTimeEmployees) || undefined,
      country: d.country,
      ipoDate: d.ipoDate,
      image: d.image,
      beta: d.beta,
    };
  } catch {
    return null;
  }
}

export async function getIncomeStatement(ticker: string, limit = 5): Promise<FinancialData[]> {
  try {
    const data = await fmpFetch<Array<Record<string, unknown>>>(`/income-statement/${ticker}`, {
      period: 'annual',
      limit: String(limit),
    });
    return data.map((d) => ({
      period: `${(d.calendarYear as string) || (d.date as string)?.substring(0, 4)}-FY`,
      periodDate: d.date as string,
      revenue: d.revenue as number | null,
      netIncome: d.netIncome as number | null,
      ebitda: d.ebitda as number | null,
      eps: d.eps as number | null,
      grossMargin: d.revenue ? (d.grossProfit as number) / (d.revenue as number) : null,
      operatingMargin: d.revenue ? (d.operatingIncome as number) / (d.revenue as number) : null,
      netMargin: d.revenue ? (d.netIncome as number) / (d.revenue as number) : null,
      freeCashFlow: null, totalDebt: null, totalEquity: null, totalAssets: null,
      pe: null, evEbitda: null, pb: null, ps: null, roe: null, roic: null,
      debtToEquity: null, currentRatio: null, revenueGrowth: null, epsGrowth: null,
      dividendYield: null, bookValuePerShare: null, operatingCashFlow: null,
      capitalExpenditure: null,
    }));
  } catch {
    return [];
  }
}

export async function getBalanceSheet(ticker: string, limit = 5): Promise<Array<Record<string, unknown>>> {
  try {
    return await fmpFetch<Array<Record<string, unknown>>>(`/balance-sheet-statement/${ticker}`, {
      period: 'annual',
      limit: String(limit),
    });
  } catch {
    return [];
  }
}

export async function getCashFlowStatement(ticker: string, limit = 5): Promise<Array<Record<string, unknown>>> {
  try {
    return await fmpFetch<Array<Record<string, unknown>>>(`/cash-flow-statement/${ticker}`, {
      period: 'annual',
      limit: String(limit),
    });
  } catch {
    return [];
  }
}

export async function getKeyMetrics(ticker: string, limit = 5): Promise<Array<Record<string, unknown>>> {
  try {
    return await fmpFetch<Array<Record<string, unknown>>>(`/key-metrics/${ticker}`, {
      period: 'annual',
      limit: String(limit),
    });
  } catch {
    return [];
  }
}

export async function getRatios(ticker: string, limit = 5): Promise<Array<Record<string, unknown>>> {
  try {
    return await fmpFetch<Array<Record<string, unknown>>>(`/ratios/${ticker}`, {
      period: 'annual',
      limit: String(limit),
    });
  } catch {
    return [];
  }
}

export async function getHistoricalPrice(ticker: string, from?: string, to?: string): Promise<HistoricalPrice[]> {
  try {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const data = await fmpFetch<{ historical: Array<{
      date: string; open: number; high: number; low: number; close: number; volume: number;
    }> }>(`/historical-price-full/${ticker}`, params);
    return (data.historical || []).map((d) => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    })).reverse();
  } catch {
    return [];
  }
}

export async function getQuote(ticker: string): Promise<{ price: number; change: number; changePercent: number; volume: number; marketCap: number } | null> {
  try {
    const data = await fmpFetch<Array<{
      price: number; change: number; changesPercentage: number; volume: number; marketCap: number;
    }>>(`/quote/${ticker}`);
    if (!data || data.length === 0) return null;
    return {
      price: data[0].price,
      change: data[0].change,
      changePercent: data[0].changesPercentage,
      volume: data[0].volume,
      marketCap: data[0].marketCap,
    };
  } catch {
    return null;
  }
}

export async function getSP500List(): Promise<Array<{ symbol: string; name: string; sector: string }>> {
  try {
    return await fmpFetch<Array<{ symbol: string; name: string; sector: string }>>('/sp500_constituent');
  } catch {
    return [];
  }
}

export async function getStockScreener(params: {
  marketCapMoreThan?: number;
  exchange?: string;
  limit?: number;
}): Promise<Array<{ symbol: string; companyName: string; sector: string; industry: string; marketCap: number; price: number; exchange: string }>> {
  try {
    const queryParams: Record<string, string> = {};
    if (params.marketCapMoreThan) queryParams.marketCapMoreThan = String(params.marketCapMoreThan);
    if (params.exchange) queryParams.exchange = params.exchange;
    if (params.limit) queryParams.limit = String(params.limit);
    return await fmpFetch('/stock-screener', queryParams);
  } catch {
    return [];
  }
}

export async function searchCompany(query: string): Promise<Array<{ symbol: string; name: string; exchange: string }>> {
  try {
    return await fmpFetch<Array<{ symbol: string; name: string; exchange: string }>>('/search', {
      query,
      limit: '10',
      exchange: 'NYSE,NASDAQ',
    });
  } catch {
    return [];
  }
}
