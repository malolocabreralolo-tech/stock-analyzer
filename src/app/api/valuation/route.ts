import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCompanyData, getFinancials } from '@/lib/data-sources/aggregator';
import { calculateCompositeValuation } from '@/lib/valuation/composite';

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
  if (financials.length === 0) {
    return NextResponse.json({ error: 'No financial data available' }, { status: 404 });
  }

  const valuation = calculateCompositeValuation(
    financials,
    profile.price,
    profile.sector,
    profile.marketCap,
  );

  // Save to DB
  const company = await prisma.company.findUnique({ where: { ticker: upperTicker } });
  if (company) {
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

  return NextResponse.json(valuation);
}
