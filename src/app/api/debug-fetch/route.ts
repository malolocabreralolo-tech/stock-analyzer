import { NextRequest, NextResponse } from 'next/server';
import { getFinancials, getCompanyData, getHistoricalPrices } from '@/lib/data-sources/aggregator';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker') || 'AAPL';
  const results: Record<string, unknown> = {};

  // Test the actual aggregator functions one at a time
  try {
    const t0 = Date.now();
    const profile = await getCompanyData(ticker);
    results.profile = {
      ok: !!profile,
      price: profile?.price,
      name: profile?.name,
      ms: Date.now() - t0,
    };
  } catch (e: any) {
    results.profile = { error: e.message?.substring(0, 300) };
  }

  try {
    const t0 = Date.now();
    const financials = await getFinancials(ticker);
    results.financials = {
      count: financials.length,
      periods: financials.slice(0, 3).map((f) => f.period),
      firstEps: financials[0]?.eps,
      firstEvEbitda: financials[0]?.evEbitda,
      ms: Date.now() - t0,
    };
  } catch (e: any) {
    results.financials = { error: e.message?.substring(0, 300) };
  }

  try {
    const t0 = Date.now();
    const prices = await getHistoricalPrices(ticker);
    results.prices = {
      count: prices.length,
      lastClose: prices.length > 0 ? prices[prices.length - 1].close : null,
      ms: Date.now() - t0,
    };
  } catch (e: any) {
    results.prices = { error: e.message?.substring(0, 300) };
  }

  return NextResponse.json(results);
}
