import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker') || 'AAPL';
  const results: Record<string, unknown> = {};

  // Test 1: Basic fetch to SEC EDGAR
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'StockAnalyzer/1.0 contact@stockanalyzer.com' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    results.edgar_cik = { status: res.status, ok: res.ok };
  } catch (e: any) {
    results.edgar_cik = { error: e.message };
  }

  // Test 2: Yahoo Finance quoteSummary
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yf = new YahooFinance();
    const profile = await Promise.race([
      yf.quoteSummary(ticker, { modules: ['price'] }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ]) as any;
    results.yahoo_profile = {
      price: profile?.price?.regularMarketPrice,
      name: profile?.price?.longName,
    };
  } catch (e: any) {
    results.yahoo_profile = { error: e.message?.substring(0, 200) };
  }

  // Test 3: Yahoo Finance fundamentalsTimeSeries
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yf = new YahooFinance();
    const data = await Promise.race([
      yf.fundamentalsTimeSeries(ticker, {
        period1: new Date('2020-01-01'),
        type: 'annual',
        module: 'financials',
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ]) as any[];
    results.yahoo_financials = { count: data?.length || 0, firstDate: data?.[0]?.date };
  } catch (e: any) {
    results.yahoo_financials = { error: e.message?.substring(0, 200) };
  }

  // Test 4: Yahoo Finance chart
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yf = new YahooFinance();
    const data = await Promise.race([
      yf.chart(ticker, { period1: new Date('2024-01-01'), interval: '1wk' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ]) as any;
    results.yahoo_chart = { quotes: data?.quotes?.length || 0 };
  } catch (e: any) {
    results.yahoo_chart = { error: e.message?.substring(0, 200) };
  }

  return NextResponse.json(results);
}
