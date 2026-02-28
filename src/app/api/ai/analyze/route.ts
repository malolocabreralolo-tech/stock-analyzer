import { NextRequest, NextResponse } from 'next/server';
import { getCompanyData, getFinancials } from '@/lib/data-sources/aggregator';
import { calculateCompositeValuation } from '@/lib/valuation/composite';
import { generateAnalysis } from '@/lib/ai/analyst';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  const upperTicker = ticker.toUpperCase();
  const profile = await getCompanyData(upperTicker);
  if (!profile) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const financials = await getFinancials(upperTicker);
  const valuation = calculateCompositeValuation(
    financials,
    profile.price,
    profile.sector,
    profile.marketCap,
  );

  const analysis = await generateAnalysis(profile, financials, valuation);
  return NextResponse.json(analysis);
}
