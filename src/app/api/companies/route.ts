import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCompanyData, searchCompanies } from '@/lib/data-sources/aggregator';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const ticker = searchParams.get('ticker');

  if (ticker) {
    const company = await getCompanyData(ticker.toUpperCase());
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json(company);
  }

  if (query) {
    const results = await searchCompanies(query);
    return NextResponse.json(results);
  }

  // Return all cached companies
  const companies = await prisma.company.findMany({
    orderBy: { marketCap: 'desc' },
    take: 100,
  });
  return NextResponse.json(companies);
}
