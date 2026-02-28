import { NextRequest, NextResponse } from 'next/server';
import * as edgar from '@/lib/data-sources/edgar';
import * as yahooV2 from '@/lib/data-sources/yahoo-v2';
import * as mock from '@/lib/data-sources/mock';
import prisma from '@/lib/db';
import { FinancialData } from '@/types';

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get('ticker') || 'AAPL').toUpperCase();
  const results: Record<string, unknown> = {};

  // Step 1: Check DB cache state
  const company = await prisma.company.findUnique({
    where: { ticker },
    include: { financials: { orderBy: { period: 'desc' } } },
  });
  results.db_cache = {
    exists: !!company,
    financialCount: company?.financials?.length ?? 0,
    updatedAt: company?.updatedAt?.toISOString(),
    price: company?.price,
  };

  // Step 2: Check useMockData
  const fmpKey = process.env.FMP_API_KEY;
  const isMock = !fmpKey || fmpKey === 'your_fmp_api_key_here';
  results.useMockData = isMock;

  // Step 3: Try EDGAR
  let edgarData: FinancialData[] = [];
  try {
    const t0 = Date.now();
    edgarData = await edgar.getEdgarFinancials(ticker);
    results.edgar = { count: edgarData.length, ms: Date.now() - t0 };
  } catch (e: any) {
    results.edgar = { error: e.message?.substring(0, 200) };
  }

  // Step 4: Try Yahoo
  let yahooData: FinancialData[] = [];
  try {
    const t0 = Date.now();
    yahooData = await yahooV2.getYahooV2Financials(ticker);
    results.yahoo = { count: yahooData.length, ms: Date.now() - t0 };
  } catch (e: any) {
    results.yahoo = { error: e.message?.substring(0, 200) };
  }

  // Step 5: Try both in parallel (like aggregator does)
  try {
    const t0 = Date.now();
    const [e, y] = await Promise.all([
      edgar.getEdgarFinancials(ticker).catch((err: any) => { results.edgar_parallel_err = err.message?.substring(0, 200); return [] as FinancialData[]; }),
      yahooV2.getYahooV2Financials(ticker).catch((err: any) => { results.yahoo_parallel_err = err.message?.substring(0, 200); return [] as FinancialData[]; }),
    ]);
    results.parallel = { edgar: e.length, yahoo: y.length, ms: Date.now() - t0 };
  } catch (e: any) {
    results.parallel = { error: e.message?.substring(0, 200) };
  }

  // Step 6: Check mock fallback
  const mockData = mock.getMockFinancials(ticker);
  results.mock = { count: mockData.length };

  return NextResponse.json(results);
}
