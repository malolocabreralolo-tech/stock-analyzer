import { CompanyProfile, HistoricalPrice } from '@/types';

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance';

async function yahooFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Yahoo API error: ${res.status}`);
  return res.json();
}

export async function getYahooQuote(ticker: string): Promise<{
  price: number; marketCap: number; pe: number | null; eps: number | null;
  dividendYield: number | null; name: string; sector: string; industry: string;
} | null> {
  try {
    const data = await yahooFetch<{
      quoteSummary?: {
        result?: Array<{
          price?: { regularMarketPrice?: { raw: number }; marketCap?: { raw: number } };
          summaryDetail?: {
            trailingPE?: { raw: number }; dividendYield?: { raw: number };
          };
          defaultKeyStatistics?: { trailingEps?: { raw: number } };
          assetProfile?: { sector?: string; industry?: string; longBusinessSummary?: string };
          quoteType?: { longName?: string };
        }>;
      };
    }>(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=price,summaryDetail,defaultKeyStatistics,assetProfile,quoteType`);

    const result = data?.quoteSummary?.result?.[0];
    if (!result) return null;

    return {
      price: result.price?.regularMarketPrice?.raw || 0,
      marketCap: result.price?.marketCap?.raw || 0,
      pe: result.summaryDetail?.trailingPE?.raw || null,
      eps: result.defaultKeyStatistics?.trailingEps?.raw || null,
      dividendYield: result.summaryDetail?.dividendYield?.raw || null,
      name: result.quoteType?.longName || ticker,
      sector: result.assetProfile?.sector || 'Unknown',
      industry: result.assetProfile?.industry || 'Unknown',
    };
  } catch {
    return null;
  }
}

export async function getYahooHistoricalPrice(ticker: string, period = '5y'): Promise<HistoricalPrice[]> {
  try {
    const data = await yahooFetch<{
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: number[]; high?: number[]; low?: number[]; close?: number[]; volume?: number[];
            }>;
          };
        }>;
      };
    }>(`${YAHOO_BASE}/chart/${ticker}?range=${period}&interval=1d`);

    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return [];

    const quote = result.indicators?.quote?.[0];
    if (!quote) return [];

    return result.timestamp.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: quote.open?.[i] || 0,
      high: quote.high?.[i] || 0,
      low: quote.low?.[i] || 0,
      close: quote.close?.[i] || 0,
      volume: quote.volume?.[i] || 0,
    })).filter((d) => d.close > 0);
  } catch {
    return [];
  }
}

export async function getYahooProfile(ticker: string): Promise<CompanyProfile | null> {
  const quote = await getYahooQuote(ticker);
  if (!quote) return null;
  return {
    ticker,
    name: quote.name,
    sector: quote.sector,
    industry: quote.industry,
    marketCap: quote.marketCap,
    exchange: 'UNKNOWN',
    price: quote.price,
  };
}
