import { NextRequest, NextResponse } from 'next/server';
import * as edgar from '@/lib/data-sources/edgar';
import * as yahooV2 from '@/lib/data-sources/yahoo-v2';
import { getFinancials } from '@/lib/data-sources/aggregator';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker') || 'AAPL';
  const results: Record<string, unknown> = {};

  // Test EDGAR directly
  try {
    const t0 = Date.now();
    const data = await edgar.getEdgarFinancials(ticker);
    results.edgar = { count: data.length, periods: data.slice(0, 3).map((f) => f.period), ms: Date.now() - t0 };
  } catch (e: any) {
    results.edgar = { error: e.message?.substring(0, 300), ms: 0 };
  }

  // Test Yahoo directly
  try {
    const t0 = Date.now();
    const data = await yahooV2.getYahooV2Financials(ticker);
    results.yahoo = { count: data.length, periods: data.slice(0, 3).map((f) => f.period), ms: Date.now() - t0 };
  } catch (e: any) {
    results.yahoo = { error: e.message?.substring(0, 300), ms: 0 };
  }

  // Test aggregator
  try {
    const t0 = Date.now();
    const data = await getFinancials(ticker);
    results.aggregator = { count: data.length, periods: data.slice(0, 3).map((f) => f.period), ms: Date.now() - t0 };
  } catch (e: any) {
    results.aggregator = { error: e.message?.substring(0, 300), ms: 0 };
  }

  return NextResponse.json(results);
}
