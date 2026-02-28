/* eslint-disable @typescript-eslint/no-explicit-any */
import YahooFinance from 'yahoo-finance2';
import { CompanyProfile, DynamicRatioPoint, FinancialData, HistoricalPrice } from '@/types';

const yf = new YahooFinance();

export async function getYahooV2Profile(ticker: string): Promise<CompanyProfile | null> {
  try {
    const result: any = await yf.quoteSummary(ticker, {
      modules: ['price', 'summaryDetail', 'assetProfile', 'quoteType'],
    });

    const price = result.price;
    const profile = result.assetProfile;
    const quoteType = result.quoteType;

    return {
      ticker,
      name: quoteType?.longName || price?.longName || ticker,
      sector: profile?.sector || 'Unknown',
      industry: profile?.industry || 'Unknown',
      marketCap: price?.marketCap || 0,
      exchange: price?.exchangeName || 'UNKNOWN',
      price: price?.regularMarketPrice || 0,
    };
  } catch (e) {
    console.error(`[yahoo-v2] Failed to fetch profile for ${ticker}:`, e);
    return null;
  }
}

export async function getYahooV2Financials(ticker: string): Promise<FinancialData[]> {
  try {
    // Use fundamentalsTimeSeries (income statement history modules are deprecated since Nov 2024)
    const historyStart = new Date('2000-01-01');

    const [financialsData, balanceSheetData, cashFlowData, summary, chartResult]: [any[], any[], any[], any, any] = await Promise.all([
      yf.fundamentalsTimeSeries(ticker, {
        period1: historyStart,
        type: 'annual',
        module: 'financials',
      }),
      yf.fundamentalsTimeSeries(ticker, {
        period1: historyStart,
        type: 'annual',
        module: 'balance-sheet',
      }),
      yf.fundamentalsTimeSeries(ticker, {
        period1: historyStart,
        type: 'annual',
        module: 'cash-flow',
      }),
      yf.quoteSummary(ticker, {
        modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail'],
      }),
      yf.chart(ticker, {
        period1: historyStart,
        interval: '1d',
      }),
    ]);

    // Merge rows from 3 modules by date into unified snapshots
    const mergedMap = new Map<string, any>();
    for (const row of (financialsData || [])) {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const key = d.toISOString().split('T')[0];
      mergedMap.set(key, { ...row, date: d });
    }
    for (const row of (balanceSheetData || [])) {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const key = d.toISOString().split('T')[0];
      mergedMap.set(key, { ...(mergedMap.get(key) || {}), ...row, date: d });
    }
    for (const row of (cashFlowData || [])) {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const key = d.toISOString().split('T')[0];
      mergedMap.set(key, { ...(mergedMap.get(key) || {}), ...row, date: d });
    }
    const allData = Array.from(mergedMap.values());

    if (!allData || allData.length === 0) return [];

    const finData = summary?.financialData;
    const summaryDetail = summary?.summaryDetail;

    // Build price lookup from historical data for calculating valuation ratios
    const priceMap = new Map<string, number>();
    if (chartResult?.quotes) {
      for (const q of chartResult.quotes) {
        if (q.close != null && q.close > 0) {
          const dateStr = q.date instanceof Date
            ? q.date.toISOString().split('T')[0]
            : String(q.date).split('T')[0];
          priceMap.set(dateStr, q.close);
        }
      }
    }

    // Filter out rows with no meaningful data, then sort by date descending
    const meaningful = allData.filter((row: any) =>
      safeNum(row.totalRevenue) != null || safeNum(row.netIncome) != null || safeNum(row.totalAssets) != null
    );
    const sorted = meaningful.sort((a: any, b: any) => {
      const da = a.date instanceof Date ? a.date.getTime() : 0;
      const db = b.date instanceof Date ? b.date.getTime() : 0;
      return db - da;
    });

    if (sorted.length === 0) return [];

    const financials: FinancialData[] = sorted.map((row: any, i: number) => {
      const date = row.date instanceof Date ? row.date : new Date(row.date);
      const year = date.getFullYear();

      const revenue = safeNum(row.totalRevenue);
      const netIncome = safeNum(row.netIncome);
      const ebitda = safeNum(row.EBITDA) ?? safeNum(row.normalizedEBITDA);
      const grossProfit = safeNum(row.grossProfit);
      const operatingIncome = safeNum(row.operatingIncome);
      const totalDebt = safeNum(row.totalDebt);
      const totalEquity = safeNum(row.stockholdersEquity) ?? safeNum(row.commonStockEquity);
      const totalAssets = safeNum(row.totalAssets);
      const operatingCashFlow = safeNum(row.operatingCashFlow);
      const capitalExpenditure = safeNum(row.capitalExpenditure);
      const cash = safeNum(row.cashAndCashEquivalents);
      const sharesOutstanding = safeNum(row.dilutedAverageShares) ?? safeNum(row.ordinarySharesNumber);
      const fcf = safeNum(row.freeCashFlow) ?? (
        operatingCashFlow != null && capitalExpenditure != null
          ? operatingCashFlow + capitalExpenditure
          : null
      );

      const grossMargin = revenue && grossProfit ? grossProfit / revenue : null;
      const operatingMargin = revenue && operatingIncome ? operatingIncome / revenue : null;
      const netMargin = revenue && netIncome ? netIncome / revenue : null;
      const roe = totalEquity && netIncome ? netIncome / totalEquity : null;
      const debtToEquity = totalEquity && totalDebt ? totalDebt / totalEquity : null;
      const eps = safeNum(row.dilutedEPS) ?? safeNum(row.basicEPS);

      // Find price at fiscal year-end for historical valuation ratios
      // For the most recent row, use current price; for older rows, find nearest price
      const priceAtDate = i === 0
        ? safeNum(finData?.currentPrice)
        : findNearestPrice(priceMap, date);

      // Calculate historical valuation ratios using price at each fiscal year-end
      let pe: number | null = null;
      let evEbitda: number | null = null;
      let pb: number | null = null;
      let ps: number | null = null;

      if (priceAtDate) {
        // P/E = Price / EPS
        if (eps && eps > 0) {
          pe = priceAtDate / eps;
        }

        // P/B = Price / (Equity / Shares)
        if (totalEquity && sharesOutstanding && sharesOutstanding > 0) {
          const bookValuePerShare = totalEquity / sharesOutstanding;
          if (bookValuePerShare > 0) {
            pb = priceAtDate / bookValuePerShare;
          }
        }

        // P/S = Market Cap / Revenue
        if (revenue && sharesOutstanding) {
          const marketCap = priceAtDate * sharesOutstanding;
          ps = marketCap / revenue;
        }

        // EV/EBITDA = (Market Cap + Total Debt - Cash) / EBITDA
        if (ebitda && ebitda > 0 && sharesOutstanding) {
          const marketCap = priceAtDate * sharesOutstanding;
          const ev = marketCap + (totalDebt || 0) - (cash || 0);
          evEbitda = ev / ebitda;
        }
      }

      // For most recent row, prefer Yahoo's own current ratios if available
      if (i === 0) {
        pe = safeNum(summaryDetail?.trailingPE) ?? pe;
      }

      return {
        period: `${year}-FY`,
        periodDate: date.toISOString(),
        revenue,
        netIncome,
        ebitda,
        eps,
        freeCashFlow: fcf,
        operatingCashFlow,
        capitalExpenditure,
        totalDebt,
        totalEquity,
        totalAssets,
        bookValuePerShare: totalEquity && sharesOutstanding ? totalEquity / sharesOutstanding : null,
        pe,
        evEbitda,
        pb,
        ps,
        roe,
        roic: null,
        debtToEquity,
        currentRatio: i === 0 ? safeNum(finData?.currentRatio) : null,
        grossMargin,
        operatingMargin,
        netMargin,
        revenueGrowth: null,
        epsGrowth: null,
        dividendYield: i === 0 ? safeNum(summaryDetail?.dividendYield) : null,
      };
    });

    // Calculate growth rates
    for (let i = 0; i < financials.length - 1; i++) {
      const current = financials[i];
      const previous = financials[i + 1];
      if (current.revenue && previous.revenue && previous.revenue !== 0) {
        current.revenueGrowth = (current.revenue - previous.revenue) / Math.abs(previous.revenue);
      }
      if (current.eps && previous.eps && previous.eps !== 0) {
        current.epsGrowth = (current.eps - previous.eps) / Math.abs(previous.eps);
      }
    }

    return financials;
  } catch (e) {
    console.error(`[yahoo-v2] Failed to fetch financials for ${ticker}:`, e);
    return [];
  }
}

/** Find the closing price nearest to a target date (within ±7 days) */
function findNearestPrice(priceMap: Map<string, number>, targetDate: Date): number | null {
  // Try exact date first, then search ±1..7 days
  for (let offset = 0; offset <= 7; offset++) {
    for (const sign of [0, -1, 1]) {
      const d = new Date(targetDate);
      d.setDate(d.getDate() + offset * (sign || 1));
      const key = d.toISOString().split('T')[0];
      const price = priceMap.get(key);
      if (price) return price;
    }
  }
  return null;
}

export async function getYahooV2HistoricalPrices(ticker: string): Promise<HistoricalPrice[]> {
  try {
    const historyStart = new Date('2000-01-01');

    const result: any = await yf.chart(ticker, {
      period1: historyStart,
      interval: '1d',
    });

    if (!result?.quotes || result.quotes.length === 0) return [];

    return result.quotes
      .filter((q: any) => q.close != null && q.close > 0)
      .map((q: any) => ({
        date: q.date instanceof Date ? q.date.toISOString().split('T')[0] : String(q.date).split('T')[0],
        open: q.open || 0,
        high: q.high || 0,
        low: q.low || 0,
        close: q.close || 0,
        volume: q.volume || 0,
      }));
  } catch (e) {
    console.error(`[yahoo-v2] Failed to fetch historical prices for ${ticker}:`, e);
    return [];
  }
}

/** A single stock split event. */
export interface SplitEvent {
  /** ISO date string (YYYY-MM-DD) when the split took effect. */
  date: string;
  /** Split factor: new shares per old share (e.g. 7 for a 7:1 split). */
  factor: number;
}

/**
 * Fetch historical stock split events for a ticker from the Yahoo Finance chart
 * endpoint. Returns events sorted ascending by date.
 *
 * The split events are embedded in `chart.events.splits` and each entry has
 * `numerator` / `denominator` fields representing the ratio (e.g. numerator=7,
 * denominator=1 for a 7:1 split where each old share becomes 7 new shares).
 */
export async function getYahooV2SplitHistory(ticker: string): Promise<SplitEvent[]> {
  try {
    const historyStart = new Date('2000-01-01');

    const result: any = await yf.chart(ticker, {
      period1: historyStart,
      interval: '1d',
    });

    const rawSplits: any[] = result?.events?.splits ?? [];
    const splits: SplitEvent[] = [];

    for (const s of rawSplits) {
      // date may be a Date object or a string/number
      let dateStr: string;
      if (s.date instanceof Date) {
        dateStr = s.date.toISOString().split('T')[0];
      } else if (typeof s.date === 'string' && s.date.length >= 10) {
        dateStr = s.date.substring(0, 10);
      } else if (typeof s.date === 'number') {
        dateStr = new Date(s.date * 1000).toISOString().split('T')[0];
      } else {
        continue; // skip malformed entries
      }

      // numerator / denominator give the split ratio (e.g. 7 / 1 = 7:1 split)
      const numerator = Number(s.numerator);
      const denominator = Number(s.denominator);
      if (!isFinite(numerator) || !isFinite(denominator) || denominator === 0) continue;

      splits.push({ date: dateStr, factor: numerator / denominator });
    }

    // Sort ascending by date so callers can process them in chronological order
    splits.sort((a, b) => a.date.localeCompare(b.date));
    return splits;
  } catch (e) {
    console.error(`[yahoo-v2] Failed to fetch split history for ${ticker}:`, e);
    return [];
  }
}

/**
 * Generate a dynamic ratio time series (monthly) combining:
 * - Quarterly/annual financial snapshots (static, updated each earnings report)
 * - Monthly price data (dynamic)
 *
 * For each month, ratios are calculated using the most recent financial data
 * available at that point + the closing price of that month.
 * This produces continuous ratio lines like Bloomberg/Koyfin.
 */
export async function getYahooV2DynamicRatios(ticker: string): Promise<DynamicRatioPoint[]> {
  try {
    const historyStart = new Date('2000-01-01');

    const [
      annualFinancials, annualBalanceSheet, annualCashFlow,
      quarterlyFinancials, quarterlyBalanceSheet, quarterlyCashFlow,
      chartResult,
    ]: [any[], any[], any[], any[], any[], any[], any] = await Promise.all([
      yf.fundamentalsTimeSeries(ticker, {
        period1: historyStart,
        type: 'annual',
        module: 'financials',
      }),
      yf.fundamentalsTimeSeries(ticker, {
        period1: historyStart,
        type: 'annual',
        module: 'balance-sheet',
      }),
      yf.fundamentalsTimeSeries(ticker, {
        period1: historyStart,
        type: 'annual',
        module: 'cash-flow',
      }),
      yf.fundamentalsTimeSeries(ticker, {
        period1: historyStart,
        type: 'quarterly',
        module: 'financials',
      }),
      yf.fundamentalsTimeSeries(ticker, {
        period1: historyStart,
        type: 'quarterly',
        module: 'balance-sheet',
      }),
      yf.fundamentalsTimeSeries(ticker, {
        period1: historyStart,
        type: 'quarterly',
        module: 'cash-flow',
      }),
      yf.chart(ticker, {
        period1: historyStart,
        interval: '1d',
      }),
    ]);

    // Merge annual rows from 3 modules by date
    const annualMergedMap = new Map<string, any>();
    for (const row of (annualFinancials || [])) {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const key = d.toISOString().split('T')[0];
      annualMergedMap.set(key, { ...row, date: d });
    }
    for (const row of (annualBalanceSheet || [])) {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const key = d.toISOString().split('T')[0];
      annualMergedMap.set(key, { ...(annualMergedMap.get(key) || {}), ...row, date: d });
    }
    for (const row of (annualCashFlow || [])) {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const key = d.toISOString().split('T')[0];
      annualMergedMap.set(key, { ...(annualMergedMap.get(key) || {}), ...row, date: d });
    }
    const annualData = Array.from(annualMergedMap.values());

    // Merge quarterly rows from 3 modules by date
    const quarterlyMergedMap = new Map<string, any>();
    for (const row of (quarterlyFinancials || [])) {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const key = d.toISOString().split('T')[0];
      quarterlyMergedMap.set(key, { ...row, date: d });
    }
    for (const row of (quarterlyBalanceSheet || [])) {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const key = d.toISOString().split('T')[0];
      quarterlyMergedMap.set(key, { ...(quarterlyMergedMap.get(key) || {}), ...row, date: d });
    }
    for (const row of (quarterlyCashFlow || [])) {
      const d = row.date instanceof Date ? row.date : new Date(row.date);
      const key = d.toISOString().split('T')[0];
      quarterlyMergedMap.set(key, { ...(quarterlyMergedMap.get(key) || {}), ...row, date: d });
    }
    const quarterlyData = Array.from(quarterlyMergedMap.values());

    if (!chartResult?.quotes || chartResult.quotes.length === 0) return [];

    // Build monthly price array
    const monthlyPrices: { date: Date; close: number }[] = chartResult.quotes
      .filter((q: any) => q.close != null && q.close > 0)
      .map((q: any) => ({
        date: q.date instanceof Date ? q.date : new Date(q.date),
        close: q.close,
      }));

    if (monthlyPrices.length === 0) return [];

    // Build financial snapshots sorted by date ascending
    // Each snapshot represents a point in time when financial data was reported
    interface FinSnapshot {
      date: Date;
      eps: number | null;        // TTM or annual
      revenue: number | null;    // TTM or annual
      netIncome: number | null;
      ebitda: number | null;
      fcf: number | null;
      totalDebt: number | null;
      cash: number | null;
      totalEquity: number | null;
      shares: number | null;
      grossProfit: number | null;
      operatingIncome: number | null;
    }

    const snapshots: FinSnapshot[] = [];

    // Add annual snapshots
    const annualMeaningful = (annualData || []).filter((r: any) => safeNum(r.totalRevenue) != null);
    for (const row of annualMeaningful) {
      const date = row.date instanceof Date ? row.date : new Date(row.date);
      snapshots.push({
        date,
        eps: safeNum(row.dilutedEPS) ?? safeNum(row.basicEPS),
        revenue: safeNum(row.totalRevenue),
        netIncome: safeNum(row.netIncome),
        ebitda: safeNum(row.EBITDA) ?? safeNum(row.normalizedEBITDA),
        fcf: safeNum(row.freeCashFlow),
        totalDebt: safeNum(row.totalDebt),
        cash: safeNum(row.cashAndCashEquivalents),
        totalEquity: safeNum(row.stockholdersEquity) ?? safeNum(row.commonStockEquity),
        shares: safeNum(row.dilutedAverageShares) ?? safeNum(row.ordinarySharesNumber),
        grossProfit: safeNum(row.grossProfit),
        operatingIncome: safeNum(row.operatingIncome),
      });
    }

    // Add quarterly TTM snapshots (sum trailing 4 quarters where available)
    const quarterlyMeaningful = (quarterlyData || [])
      .filter((r: any) => safeNum(r.totalRevenue) != null)
      .sort((a: any, b: any) => {
        const da = (a.date instanceof Date ? a.date : new Date(a.date)).getTime();
        const db = (b.date instanceof Date ? b.date : new Date(b.date)).getTime();
        return da - db;
      });

    for (let i = 3; i < quarterlyMeaningful.length; i++) {
      const q = [quarterlyMeaningful[i - 3], quarterlyMeaningful[i - 2], quarterlyMeaningful[i - 1], quarterlyMeaningful[i]];
      const date = q[3].date instanceof Date ? q[3].date : new Date(q[3].date);

      const sumField = (field: string) => {
        const vals = q.map((r: any) => safeNum(r[field])).filter((v): v is number => v != null);
        return vals.length === 4 ? vals.reduce((a, b) => a + b, 0) : null;
      };

      snapshots.push({
        date,
        eps: sumField('dilutedEPS') ?? sumField('basicEPS'),
        revenue: sumField('totalRevenue'),
        netIncome: sumField('netIncome'),
        ebitda: sumField('EBITDA') ?? sumField('normalizedEBITDA'),
        fcf: sumField('freeCashFlow'),
        // Balance sheet: use latest quarter, not sum
        totalDebt: safeNum(q[3].totalDebt),
        cash: safeNum(q[3].cashAndCashEquivalents),
        totalEquity: safeNum(q[3].stockholdersEquity) ?? safeNum(q[3].commonStockEquity),
        shares: safeNum(q[3].dilutedAverageShares) ?? safeNum(q[3].ordinarySharesNumber),
        grossProfit: sumField('grossProfit'),
        operatingIncome: sumField('operatingIncome'),
      });
    }

    // Sort all snapshots by date
    snapshots.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (snapshots.length === 0) return [];

    // For each monthly price, find the most recent financial snapshot and calculate ratios
    const result: DynamicRatioPoint[] = [];

    for (const mp of monthlyPrices) {
      // Find the most recent snapshot on or before this month
      let snap: FinSnapshot | null = null;
      for (let i = snapshots.length - 1; i >= 0; i--) {
        if (snapshots[i].date <= mp.date) {
          snap = snapshots[i];
          break;
        }
      }

      // If no snapshot available yet (price is before first financial report), skip
      if (!snap) continue;

      const price = mp.close;
      const shares = snap.shares;
      const marketCap = shares ? price * shares : null;

      // P/E
      const pe = snap.eps && snap.eps > 0 ? price / snap.eps : null;

      // EV/EBITDA
      let evEbitda: number | null = null;
      if (snap.ebitda && snap.ebitda > 0 && marketCap) {
        const ev = marketCap + (snap.totalDebt || 0) - (snap.cash || 0);
        evEbitda = ev / snap.ebitda;
      }

      // P/B
      let pb: number | null = null;
      if (snap.totalEquity && shares && shares > 0) {
        const bvps = snap.totalEquity / shares;
        if (bvps > 0) pb = price / bvps;
      }

      // P/S
      const ps = snap.revenue && marketCap ? marketCap / snap.revenue : null;

      // Net Debt / EBITDA
      let netDebtToEbitda: number | null = null;
      if (snap.ebitda && snap.ebitda > 0) {
        const netDebt = (snap.totalDebt || 0) - (snap.cash || 0);
        netDebtToEbitda = netDebt / snap.ebitda;
      }

      // Margins & ratios from snapshot
      const grossMargin = snap.revenue && snap.grossProfit ? snap.grossProfit / snap.revenue : null;
      const operatingMargin = snap.revenue && snap.operatingIncome ? snap.operatingIncome / snap.revenue : null;
      const netMargin = snap.revenue && snap.netIncome ? snap.netIncome / snap.revenue : null;
      const roe = snap.totalEquity && snap.netIncome ? snap.netIncome / snap.totalEquity : null;
      const debtToEquity = snap.totalEquity && snap.totalDebt ? snap.totalDebt / snap.totalEquity : null;

      result.push({
        date: mp.date.toISOString().split('T')[0],
        price,
        pe,
        evEbitda,
        pb,
        ps,
        netDebtToEbitda,
        revenueTTM: snap.revenue,
        netIncomeTTM: snap.netIncome,
        ebitdaTTM: snap.ebitda,
        fcfTTM: snap.fcf,
        roe,
        grossMargin,
        operatingMargin,
        netMargin,
        debtToEquity,
      });
    }

    return result;
  } catch (e) {
    console.error(`[yahoo-v2] Failed to fetch dynamic ratios for ${ticker}:`, e);
    return [];
  }
}

export async function searchYahooV2(query: string): Promise<Array<{ symbol: string; name: string }>> {
  try {
    const result: any = await yf.search(query);
    return (result.quotes || [])
      .filter((q: any) => q.symbol && typeof q.symbol === 'string')
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.longname || q.shortname || q.symbol,
      }));
  } catch {
    return [];
  }
}

function safeNum(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return isFinite(n) ? n : null;
}
