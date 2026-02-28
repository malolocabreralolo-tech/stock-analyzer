import { NextRequest, NextResponse } from 'next/server';
import { getFinancials, getHistoricalPrices } from '@/lib/data-sources/aggregator';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');
  const type = searchParams.get('type'); // 'financials' | 'prices'

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  if (type === 'prices') {
    const prices = await getHistoricalPrices(ticker.toUpperCase());
    return NextResponse.json(prices);
  }

  const financials = await getFinancials(ticker.toUpperCase());
  return NextResponse.json(financials);
}
