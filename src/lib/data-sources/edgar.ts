/* eslint-disable @typescript-eslint/no-explicit-any */
import { DynamicRatioPoint, FinancialData } from '@/types';
import { getYahooV2HistoricalPrices, getYahooV2SplitHistory } from './yahoo-v2';

const SEC_USER_AGENT = 'StockAnalyzer/1.0 contact@stockanalyzer.com';
const SEC_HEADERS = { 'User-Agent': SEC_USER_AGENT };

// ─── In-memory caches ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const CIK_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FACTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cikMapCache: CacheEntry<Map<string, string>> | null = null;
const factsCache = new Map<string, CacheEntry<any>>();

// ─── Rate limiting ────────────────────────────────────────────────────────────

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 110; // ~9 req/sec to stay safely under 10/sec

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, { headers: SEC_HEADERS });
}

// ─── CIK Mapping ─────────────────────────────────────────────────────────────

async function getCikMap(): Promise<Map<string, string>> {
  if (cikMapCache && Date.now() - cikMapCache.fetchedAt < CIK_CACHE_TTL_MS) {
    return cikMapCache.data;
  }

  const response = await rateLimitedFetch('https://www.sec.gov/files/company_tickers.json');
  if (!response.ok) {
    throw new Error(`[edgar] Failed to fetch CIK map: ${response.status} ${response.statusText}`);
  }

  const raw: any = await response.json();
  const map = new Map<string, string>();

  // raw is an object like { "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." }, ... }
  for (const entry of Object.values(raw) as any[]) {
    if (entry.ticker && entry.cik_str != null) {
      map.set(String(entry.ticker).toUpperCase(), String(entry.cik_str));
    }
  }

  cikMapCache = { data: map, fetchedAt: Date.now() };
  return map;
}

async function getCik(ticker: string): Promise<string | null> {
  const map = await getCikMap();
  return map.get(ticker.toUpperCase()) ?? null;
}

// ─── Company Facts ────────────────────────────────────────────────────────────

async function getCompanyFacts(ticker: string): Promise<any | null> {
  const upperTicker = ticker.toUpperCase();
  const cached = factsCache.get(upperTicker);
  if (cached && Date.now() - cached.fetchedAt < FACTS_CACHE_TTL_MS) {
    return cached.data;
  }

  const cik = await getCik(upperTicker);
  if (!cik) {
    console.error(`[edgar] No CIK found for ticker: ${ticker}`);
    return null;
  }

  const paddedCik = cik.padStart(10, '0');
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`;

  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    console.error(`[edgar] Failed to fetch company facts for ${ticker}: ${response.status}`);
    return null;
  }

  const data = await response.json();
  factsCache.set(upperTicker, { data, fetchedAt: Date.now() });
  return data;
}

// ─── XBRL helpers ─────────────────────────────────────────────────────────────

/** Extract annual FY 10-K data points for a us-gaap tag, deduped by end date. */
function extractAnnualPoints(facts: any, tagName: string): Map<string, number> {
  const result = new Map<string, number>(); // end date → value
  const usGaap = facts?.facts?.['us-gaap'];
  if (!usGaap) return result;

  const tag = usGaap[tagName];
  if (!tag?.units) return result;

  // Find the unit that has numeric values (prefer USD, then shares, then pure)
  const unitKeys = Object.keys(tag.units);
  const preferredUnit = unitKeys.find((u) => u === 'USD') ??
    unitKeys.find((u) => u === 'shares') ??
    unitKeys[0];

  if (!preferredUnit) return result;

  const dataPoints: any[] = tag.units[preferredUnit] ?? [];

  // Filter: FY only, 10-K or 10-K/A
  const fyPoints = dataPoints.filter(
    (p: any) => p.fp === 'FY' && (p.form === '10-K' || p.form === '10-K/A')
  );

  // Group by end date, keep the most recently filed (latest filed date)
  const byEndDate = new Map<string, any>();
  for (const p of fyPoints) {
    const existing = byEndDate.get(p.end);
    if (!existing || (p.filed ?? '') > (existing.filed ?? '')) {
      byEndDate.set(p.end, p);
    }
  }

  for (const [endDate, p] of byEndDate.entries()) {
    if (p.val != null && isFinite(Number(p.val))) {
      result.set(endDate, Number(p.val));
    }
  }

  return result;
}

/** Extract the first available tag from a list of candidates. Returns merged map. */
function extractWithFallback(facts: any, tags: string[]): Map<string, number> {
  // We collect from all tags and merge, preferring earlier tags for the same date
  const combined = new Map<string, number>();
  // Process in reverse so earlier (higher priority) tags overwrite later ones
  for (let i = tags.length - 1; i >= 0; i--) {
    const points = extractAnnualPoints(facts, tags[i]);
    for (const [date, val] of points.entries()) {
      combined.set(date, val);
    }
  }
  return combined;
}

// ─── getEdgarFinancials ───────────────────────────────────────────────────────

export async function getEdgarFinancials(ticker: string): Promise<FinancialData[]> {
  try {
    const facts = await getCompanyFacts(ticker);
    if (!facts) return [];

    // Extract annual data for each field
    const revenueMap = extractWithFallback(facts, [
      'Revenues',
      'SalesRevenueNet',
      'RevenueFromContractWithCustomerExcludingAssessedTax',
    ]);
    const netIncomeMap = extractAnnualPoints(facts, 'NetIncomeLoss');
    const epsMap = extractWithFallback(facts, ['EarningsPerShareBasic', 'EarningsPerShareDiluted']);
    const grossProfitMap = extractAnnualPoints(facts, 'GrossProfit');
    const operatingIncomeMap = extractAnnualPoints(facts, 'OperatingIncomeLoss');
    const totalAssetsMap = extractAnnualPoints(facts, 'Assets');
    const totalEquityMap = extractAnnualPoints(facts, 'StockholdersEquity');
    const totalDebtMap = extractWithFallback(facts, ['LongTermDebt', 'LongTermDebtNoncurrent']);
    const cashMap = extractAnnualPoints(facts, 'CashAndCashEquivalentsAtCarryingValue');
    const sharesMap = extractWithFallback(facts, [
      'CommonStockSharesOutstanding',
      'WeightedAverageNumberOfDilutedSharesOutstanding',
    ]);
    const operatingCashFlowMap = extractAnnualPoints(facts, 'NetCashProvidedByUsedInOperatingActivities');
    const capexMap = extractAnnualPoints(facts, 'PaymentsToAcquirePropertyPlantAndEquipment');
    // Bug fix: DepreciationDepletionAndAmortization only starts ~2015 in EDGAR.
    // Use a priority chain to extend coverage back to 2007+:
    //   1. DepreciationDepletionAndAmortization (2015+, primary)
    //   2. DepreciationAmortizationAndAccretionNet (2007-2017, fills gap)
    //   3. DepreciationAndAmortization (2008-2016, additional fallback)
    const depreciationMap = extractWithFallback(facts, [
      'DepreciationAndAmortization',
      'DepreciationAmortizationAndAccretionNet',
      'DepreciationDepletionAndAmortization',
    ]);

    // Collect all unique end dates across all maps
    const allDates = new Set<string>([
      ...revenueMap.keys(),
      ...netIncomeMap.keys(),
      ...epsMap.keys(),
      ...grossProfitMap.keys(),
      ...operatingIncomeMap.keys(),
      ...totalAssetsMap.keys(),
      ...totalEquityMap.keys(),
      ...totalDebtMap.keys(),
      ...cashMap.keys(),
      ...sharesMap.keys(),
      ...operatingCashFlowMap.keys(),
      ...capexMap.keys(),
      ...depreciationMap.keys(),
    ]);

    if (allDates.size === 0) return [];

    const financials: FinancialData[] = [];

    for (const endDate of allDates) {
      const revenue = revenueMap.get(endDate) ?? null;
      const netIncome = netIncomeMap.get(endDate) ?? null;
      const eps = epsMap.get(endDate) ?? null;
      const grossProfit = grossProfitMap.get(endDate) ?? null;
      const operatingIncome = operatingIncomeMap.get(endDate) ?? null;
      const totalAssets = totalAssetsMap.get(endDate) ?? null;
      const totalEquity = totalEquityMap.get(endDate) ?? null;
      const totalDebt = totalDebtMap.get(endDate) ?? null;
      const cash = cashMap.get(endDate) ?? null;
      const sharesOutstanding = sharesMap.get(endDate) ?? null;
      const operatingCashFlow = operatingCashFlowMap.get(endDate) ?? null;
      // Capex in EDGAR is reported as positive outflow (Payments...), stored as positive
      const capitalExpenditure = capexMap.get(endDate) != null ? -(capexMap.get(endDate)!) : null;
      const depreciation = depreciationMap.get(endDate) ?? null;

      // Skip entries with no meaningful data
      if (
        revenue == null &&
        netIncome == null &&
        totalAssets == null &&
        operatingCashFlow == null
      ) {
        continue;
      }

      // Derived fields
      const ebitda =
        operatingIncome != null && depreciation != null
          ? operatingIncome + depreciation
          : null;

      const freeCashFlow =
        operatingCashFlow != null && capitalExpenditure != null
          ? operatingCashFlow + capitalExpenditure // capex is already negative
          : null;

      const grossMargin = revenue && grossProfit != null ? grossProfit / revenue : null;
      const operatingMargin = revenue && operatingIncome != null ? operatingIncome / revenue : null;
      const netMargin = revenue && netIncome != null ? netIncome / revenue : null;
      const roe = totalEquity && totalEquity !== 0 && netIncome != null ? netIncome / totalEquity : null;
      const debtToEquity =
        totalEquity && totalEquity !== 0 && totalDebt != null ? totalDebt / totalEquity : null;

      const bookValuePerShare =
        totalEquity != null && sharesOutstanding && sharesOutstanding > 0
          ? totalEquity / sharesOutstanding
          : null;

      const year = endDate.substring(0, 4);

      financials.push({
        period: `${year}-FY`,
        periodDate: endDate,
        revenue,
        netIncome,
        ebitda,
        eps,
        freeCashFlow,
        operatingCashFlow,
        capitalExpenditure,
        totalDebt,
        totalEquity,
        totalAssets,
        bookValuePerShare,
        pe: null,
        evEbitda: null,
        pb: null,
        ps: null,
        roe,
        roic: null,
        debtToEquity,
        currentRatio: null,
        grossMargin,
        operatingMargin,
        netMargin,
        revenueGrowth: null,
        epsGrowth: null,
        dividendYield: null,
      });
    }

    // Sort descending by end date (newest first)
    financials.sort((a, b) => {
      const da = a.periodDate ?? '';
      const db = b.periodDate ?? '';
      return db.localeCompare(da);
    });

    // Deduplicate by period string (keep the one with more data if same year)
    const deduped = new Map<string, FinancialData>();
    for (const f of financials) {
      const existing = deduped.get(f.period);
      if (!existing) {
        deduped.set(f.period, f);
      } else {
        // Keep the one with a later periodDate (more recent fiscal year end)
        if ((f.periodDate ?? '') > (existing.periodDate ?? '')) {
          deduped.set(f.period, f);
        }
      }
    }

    const dedupedList = Array.from(deduped.values()).sort((a, b) =>
      (b.periodDate ?? '').localeCompare(a.periodDate ?? '')
    );

    // Calculate growth rates
    for (let i = 0; i < dedupedList.length - 1; i++) {
      const current = dedupedList[i];
      const previous = dedupedList[i + 1];
      if (current.revenue != null && previous.revenue != null && previous.revenue !== 0) {
        current.revenueGrowth = (current.revenue - previous.revenue) / Math.abs(previous.revenue);
      }
      if (current.eps != null && previous.eps != null && previous.eps !== 0) {
        current.epsGrowth = (current.eps - previous.eps) / Math.abs(previous.eps);
      }
    }

    return dedupedList;
  } catch (e) {
    console.error(`[edgar] Failed to fetch financials for ${ticker}:`, e);
    return [];
  }
}

// ─── Quarterly helpers for dynamic ratios ────────────────────────────────────

interface QuarterPoint {
  end: string;
  filed: string;
  val: number;
  fp: string;
  form: string;
}

/** Extract all quarterly and annual filing points for a tag (income statement items). */
function extractIncomePoints(facts: any, tagName: string): QuarterPoint[] {
  const usGaap = facts?.facts?.['us-gaap'];
  if (!usGaap) return [];

  const tag = usGaap[tagName];
  if (!tag?.units) return [];

  const unitKeys = Object.keys(tag.units);
  const preferredUnit =
    unitKeys.find((u) => u === 'USD') ??
    unitKeys.find((u) => u === 'shares') ??
    unitKeys[0];

  if (!preferredUnit) return [];

  const dataPoints: any[] = tag.units[preferredUnit] ?? [];

  return dataPoints
    .filter(
      (p: any) =>
        (p.form === '10-Q' || p.form === '10-K' || p.form === '10-K/A') &&
        p.val != null &&
        isFinite(Number(p.val))
    )
    .map((p: any) => ({
      end: p.end,
      filed: p.filed ?? '',
      val: Number(p.val),
      fp: p.fp ?? '',
      form: p.form,
    }));
}

/** Extract balance sheet points (point-in-time) deduped by end date. */
function extractBalanceSheetPoints(facts: any, tagName: string): Map<string, number> {
  const result = new Map<string, number>();
  const usGaap = facts?.facts?.['us-gaap'];
  if (!usGaap) return result;

  const tag = usGaap[tagName];
  if (!tag?.units) return result;

  const unitKeys = Object.keys(tag.units);
  const preferredUnit =
    unitKeys.find((u) => u === 'USD') ??
    unitKeys.find((u) => u === 'shares') ??
    unitKeys[0];

  if (!preferredUnit) return result;

  const dataPoints: any[] = tag.units[preferredUnit] ?? [];

  // Include both 10-Q and 10-K filings; keep most recent filing per end date
  const filtered = dataPoints.filter(
    (p: any) =>
      (p.form === '10-Q' || p.form === '10-K' || p.form === '10-K/A') &&
      p.val != null &&
      isFinite(Number(p.val))
  );

  const byEndDate = new Map<string, any>();
  for (const p of filtered) {
    const existing = byEndDate.get(p.end);
    if (!existing || (p.filed ?? '') > (existing.filed ?? '')) {
      byEndDate.set(p.end, p);
    }
  }

  for (const [endDate, p] of byEndDate.entries()) {
    result.set(endDate, Number(p.val));
  }

  return result;
}

/**
 * Convert YTD cumulative income statement points into single-quarter values.
 *
 * EDGAR 10-Q reports are YTD cumulative:
 *   Q1 = Q1_YTD
 *   Q2 = Q2_YTD - Q1_YTD
 *   Q3 = Q3_YTD - Q2_YTD
 *   Q4 = Annual - Q3_YTD (from the 10-K)
 */
function isolateQuarters(points: QuarterPoint[]): Map<string, number> {
  // Group by fiscal year (year of the end date) and sort within each year
  const byYear = new Map<string, QuarterPoint[]>();

  for (const p of points) {
    const year = p.end.substring(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(p);
  }

  const result = new Map<string, number>(); // end date → single-quarter value

  for (const [, yearPoints] of byYear.entries()) {
    // Sort by end date ascending
    yearPoints.sort((a, b) => a.end.localeCompare(b.end));

    // Deduplicate by fp (fiscal period), keeping most recent filing
    const byFP = new Map<string, QuarterPoint>();
    for (const p of yearPoints) {
      const existing = byFP.get(p.fp);
      if (!existing || p.filed > existing.filed) {
        byFP.set(p.fp, p);
      }
    }

    const q1 = byFP.get('Q1');
    const q2 = byFP.get('Q2');
    const q3 = byFP.get('Q3');
    const fy = byFP.get('FY');

    if (q1) result.set(q1.end, q1.val);
    if (q2 && q1) result.set(q2.end, q2.val - q1.val);
    else if (q2) result.set(q2.end, q2.val);
    if (q3 && q2) result.set(q3.end, q3.val - q2.val);
    else if (q3) result.set(q3.end, q3.val);
    if (fy && q3) result.set(fy.end, fy.val - q3.val);
    else if (fy) result.set(fy.end, fy.val); // fallback: use annual directly
  }

  return result;
}

// ─── getEdgarDynamicRatios ────────────────────────────────────────────────────

/**
 * Build a lookup function that returns the cumulative split factor that must be
 * applied to EDGAR as-reported share counts (or per-share data) for a given
 * date in order to convert them to the same fully-split-adjusted basis that
 * Yahoo Finance uses for its historical prices.
 *
 * Yahoo prices are retroactively adjusted: every historical price is divided by
 * the product of all subsequent split factors. EDGAR, by contrast, reports data
 * as originally filed — a 10-K filed before a 7:1 split will show shares as
 * ~900 M, not the post-split ~6.3 B.
 *
 * For a date D, the cumulative factor is the product of the split ratios of all
 * splits that occurred AFTER D (i.e. splits whose ex-date > D). Multiplying
 * EDGAR's as-reported shares by this factor produces the share count on the
 * same adjusted basis as Yahoo's prices.
 *
 * Example — Apple on 2013-09-28 (FY end, before both 2014-06-09 7:1 and
 * 2020-08-28 4:1 splits):
 *   cumulativeFactor = 7 × 4 = 28
 *   EDGAR shares ~6.5 B (already post-2014 7:1, as EDGAR backfills 10-K filings)
 *   But actually for FY2013 Apple used ~6.5 B (post-7:1 retroactively in later filings).
 *   The factor correctly accounts for whatever splits still lie in the future
 *   relative to the filing's period-end date.
 *
 * @param splits  Split events sorted ascending by date (from getYahooV2SplitHistory).
 * @returns       A function (dateStr: string) => number giving the cumulative factor.
 */
function buildCumulativeSplitFactor(splits: Array<{ date: string; factor: number }>): (dateStr: string) => number {
  // Pre-compute suffix products: for each split index i, the product of splits[i..n-1].
  // suffixProducts[i] = product of splits[i].factor * splits[i+1].factor * ... * splits[n-1].factor
  const n = splits.length;
  const suffixProducts = new Array<number>(n + 1).fill(1);
  for (let i = n - 1; i >= 0; i--) {
    suffixProducts[i] = splits[i].factor * suffixProducts[i + 1];
  }

  // For a date D, find the index of the first split whose date > D using binary search,
  // then return suffixProducts[that index].
  return function getCumulativeFactor(dateStr: string): number {
    // Binary search for first split with date > dateStr
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (splits[mid].date <= dateStr) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    // lo is now the index of the first split after dateStr
    return suffixProducts[lo];
  };
}

export async function getEdgarDynamicRatios(ticker: string): Promise<DynamicRatioPoint[]> {
  try {
    const [facts, prices, splitHistory] = await Promise.all([
      getCompanyFacts(ticker),
      getYahooV2HistoricalPrices(ticker),
      getYahooV2SplitHistory(ticker),
    ]);

    if (!facts || prices.length === 0) return [];

    // Build the cumulative-split-factor function.
    // For any EDGAR period-end date D, getCumulativeSplitFactor(D) returns the
    // product of all split ratios that occurred after D. Multiplying EDGAR's
    // as-reported shares (or dividing per-share values) by this factor brings
    // them onto the same fully-adjusted basis as Yahoo's historical prices.
    const getCumulativeSplitFactor = buildCumulativeSplitFactor(splitHistory);

    // ── Income statement items (need quarter isolation) ──────────────────────
    const revenueQtrMap = isolateQuarters([
      ...extractIncomePoints(facts, 'RevenueFromContractWithCustomerExcludingAssessedTax'),
      ...extractIncomePoints(facts, 'SalesRevenueNet'),
      ...extractIncomePoints(facts, 'Revenues'),
    ].reduce<QuarterPoint[]>((acc, p) => {
      // Deduplicate by (end, fp) keeping most recent filed across tags
      const existing = acc.find((x) => x.end === p.end && x.fp === p.fp);
      if (!existing || p.filed > existing.filed) {
        return [...acc.filter((x) => !(x.end === p.end && x.fp === p.fp)), p];
      }
      return acc;
    }, []));

    const netIncomeQtrMap = isolateQuarters(extractIncomePoints(facts, 'NetIncomeLoss'));
    const grossProfitQtrMap = isolateQuarters(extractIncomePoints(facts, 'GrossProfit'));
    const operatingIncomeQtrMap = isolateQuarters(extractIncomePoints(facts, 'OperatingIncomeLoss'));
    const operatingCFQtrMap = isolateQuarters(
      extractIncomePoints(facts, 'NetCashProvidedByUsedInOperatingActivities')
    );
    const capexQtrMap = isolateQuarters(
      extractIncomePoints(facts, 'PaymentsToAcquirePropertyPlantAndEquipment')
    );
    // Bug fix: use multiple depreciation tags to extend coverage back to 2007+.
    // Merge all quarterly depreciation points, preferring more-specific tags.
    const depreciationQtrMap = isolateQuarters(
      (() => {
        // Collect from all fallback tags; prefer DepreciationDepletionAndAmortization
        // when available (it overrides DepreciationAmortizationAndAccretionNet and
        // DepreciationAndAmortization for the same quarter).
        const allDepPoints = [
          ...extractIncomePoints(facts, 'DepreciationAndAmortization'),
          ...extractIncomePoints(facts, 'DepreciationAmortizationAndAccretionNet'),
          ...extractIncomePoints(facts, 'DepreciationDepletionAndAmortization'),
        ];
        // Deduplicate by (end, fp), keeping DepreciationDepletionAndAmortization
        // when there is overlap (it is listed last so it wins by overwriting).
        const deduped = new Map<string, QuarterPoint>();
        for (const p of allDepPoints) {
          const key = `${p.end}|${p.fp}`;
          const existing = deduped.get(key);
          if (!existing || p.filed >= existing.filed) {
            deduped.set(key, p);
          }
        }
        return Array.from(deduped.values());
      })()
    );
    const epsQtrMap = isolateQuarters([
      ...extractIncomePoints(facts, 'EarningsPerShareDiluted'),
      ...extractIncomePoints(facts, 'EarningsPerShareBasic'),
    ].reduce<QuarterPoint[]>((acc, p) => {
      const existing = acc.find((x) => x.end === p.end && x.fp === p.fp);
      if (!existing || p.filed > existing.filed) {
        return [...acc.filter((x) => !(x.end === p.end && x.fp === p.fp)), p];
      }
      return acc;
    }, []));

    // ── Balance sheet items (point-in-time) ──────────────────────────────────
    const totalAssetsBS = extractBalanceSheetPoints(facts, 'Assets');
    const totalEquityBS = extractBalanceSheetPoints(facts, 'StockholdersEquity');
    const totalDebtBS = new Map<string, number>();
    for (const [k, v] of extractBalanceSheetPoints(facts, 'LongTermDebtNoncurrent').entries()) {
      totalDebtBS.set(k, v);
    }
    for (const [k, v] of extractBalanceSheetPoints(facts, 'LongTermDebt').entries()) {
      if (!totalDebtBS.has(k)) totalDebtBS.set(k, v);
    }
    const cashBS = extractBalanceSheetPoints(facts, 'CashAndCashEquivalentsAtCarryingValue');
    const sharesBS = new Map<string, number>();
    for (const [k, v] of extractBalanceSheetPoints(
      facts,
      'WeightedAverageNumberOfDilutedSharesOutstanding'
    ).entries()) {
      sharesBS.set(k, v);
    }
    for (const [k, v] of extractBalanceSheetPoints(facts, 'CommonStockSharesOutstanding').entries()) {
      if (!sharesBS.has(k)) sharesBS.set(k, v);
    }

    // ── Build quarterly financial snapshots ───────────────────────────────────
    interface FinSnapshot {
      date: Date;
      revenue: number | null;
      netIncome: number | null;
      grossProfit: number | null;
      operatingIncome: number | null;
      operatingCF: number | null;
      capex: number | null;
      depreciation: number | null;
      eps: number | null;
      totalAssets: number | null;
      totalEquity: number | null;
      totalDebt: number | null;
      cash: number | null;
      shares: number | null;
    }

    // Collect all quarter end dates
    const allQtrDates = new Set<string>([
      ...revenueQtrMap.keys(),
      ...netIncomeQtrMap.keys(),
      ...grossProfitQtrMap.keys(),
      ...operatingIncomeQtrMap.keys(),
    ]);

    // Also include balance sheet snapshot dates
    for (const k of totalAssetsBS.keys()) allQtrDates.add(k);
    for (const k of totalEquityBS.keys()) allQtrDates.add(k);

    const sortedQtrDates = Array.from(allQtrDates).sort();

    const quarterlySnapshots: FinSnapshot[] = sortedQtrDates.map((endDate) => {
      // Cumulative split factor for this period-end date: the product of all split
      // ratios that occurred after endDate. Multiplying EDGAR's as-reported shares
      // by this factor (and dividing as-reported EPS by it) converts both values
      // to the same fully-split-adjusted basis as Yahoo's historical prices.
      const splitFactor = getCumulativeSplitFactor(endDate);

      const rawShares = findLatestBefore(sharesBS, endDate);
      const rawEps = epsQtrMap.get(endDate) ?? null;

      return {
        date: new Date(endDate),
        revenue: revenueQtrMap.get(endDate) ?? null,
        netIncome: netIncomeQtrMap.get(endDate) ?? null,
        grossProfit: grossProfitQtrMap.get(endDate) ?? null,
        operatingIncome: operatingIncomeQtrMap.get(endDate) ?? null,
        operatingCF: operatingCFQtrMap.get(endDate) ?? null,
        capex: capexQtrMap.get(endDate) != null ? -(capexQtrMap.get(endDate)!) : null,
        depreciation: depreciationQtrMap.get(endDate) ?? null,
        // Adjust EPS and shares to Yahoo's fully-split-adjusted basis.
        // splitFactor = product of all subsequent splits, so:
        //   adjustedShares = asReportedShares × splitFactor  (more shares after splits)
        //   adjustedEPS    = asReportedEPS    ÷ splitFactor  (lower EPS per share after splits)
        eps: rawEps != null ? rawEps / splitFactor : null,
        totalAssets: findLatestBefore(totalAssetsBS, endDate),
        totalEquity: findLatestBefore(totalEquityBS, endDate),
        totalDebt: findLatestBefore(totalDebtBS, endDate),
        cash: findLatestBefore(cashBS, endDate),
        shares: rawShares != null ? rawShares * splitFactor : null,
      };
    });

    // Filter out snapshots with no income data
    const meaningfulSnapshots = quarterlySnapshots.filter(
      (s) => s.revenue != null || s.netIncome != null || s.totalAssets != null
    );

    if (meaningfulSnapshots.length === 0) return [];

    // ── Build TTM snapshots (trailing 4 quarters) ─────────────────────────────
    interface TTMSnapshot {
      date: Date;
      revenueTTM: number | null;
      netIncomeTTM: number | null;
      ebitdaTTM: number | null;
      fcfTTM: number | null;
      grossProfitTTM: number | null;
      operatingIncomeTTM: number | null;
      eps: number | null;
      // Balance sheet from latest quarter
      totalAssets: number | null;
      totalEquity: number | null;
      totalDebt: number | null;
      cash: number | null;
      shares: number | null;
    }

    const ttmSnapshots: TTMSnapshot[] = [];

    for (let i = 3; i < meaningfulSnapshots.length; i++) {
      const q = [
        meaningfulSnapshots[i - 3],
        meaningfulSnapshots[i - 2],
        meaningfulSnapshots[i - 1],
        meaningfulSnapshots[i],
      ];

      const sumField = (field: keyof FinSnapshot): number | null => {
        const vals = q
          .map((s) => s[field] as number | null)
          .filter((v): v is number => v != null);
        return vals.length === 4 ? vals.reduce((a, b) => a + b, 0) : null;
      };

      const revenueTTM = sumField('revenue');
      const netIncomeTTM = sumField('netIncome');
      const operatingIncomeTTM = sumField('operatingIncome');
      const depreciationTTM = sumField('depreciation');
      const operatingCFTTM = sumField('operatingCF');
      const capexTTM = sumField('capex');
      const grossProfitTTM = sumField('grossProfit');
      const epsTTM = sumField('eps');

      const ebitdaTTM =
        operatingIncomeTTM != null && depreciationTTM != null
          ? operatingIncomeTTM + depreciationTTM
          : null;
      const fcfTTM =
        operatingCFTTM != null && capexTTM != null
          ? operatingCFTTM + capexTTM
          : null;

      const latest = q[3];
      ttmSnapshots.push({
        date: latest.date,
        revenueTTM,
        netIncomeTTM,
        ebitdaTTM,
        fcfTTM,
        grossProfitTTM,
        operatingIncomeTTM,
        eps: epsTTM,
        totalAssets: latest.totalAssets,
        totalEquity: latest.totalEquity,
        totalDebt: latest.totalDebt,
        cash: latest.cash,
        shares: latest.shares,
      });
    }

    if (ttmSnapshots.length === 0) return [];

    // Sort TTM snapshots ascending by date
    ttmSnapshots.sort((a, b) => a.date.getTime() - b.date.getTime());

    // ── Build price map ───────────────────────────────────────────────────────
    const priceMap = new Map<string, number>();
    for (const p of prices) {
      priceMap.set(p.date, p.close);
    }

    // ── For each trading day, find most recent TTM snapshot and calculate ratios
    const result: DynamicRatioPoint[] = [];

    for (const pricePoint of prices) {
      const priceDate = new Date(pricePoint.date);

      // Find most recent TTM snapshot on or before this date
      let snap: TTMSnapshot | null = null;
      for (let i = ttmSnapshots.length - 1; i >= 0; i--) {
        if (ttmSnapshots[i].date <= priceDate) {
          snap = ttmSnapshots[i];
          break;
        }
      }

      if (!snap) continue;

      const price = pricePoint.close;

      // Split-adjusted market cap calculation.
      //
      // Yahoo prices are fully split-adjusted (current basis). EDGAR shares and
      // EPS have already been corrected for subsequent splits in the snapshot
      // construction above (shares × splitFactor, EPS ÷ splitFactor), so both
      // are now on the same adjusted basis as Yahoo's prices.
      //
      // We compute market cap as: price × adjustedShares
      // All valuation ratios are then derived from aggregate dollar figures
      // (netIncome, equity, revenue) which are unaffected by stock splits:
      //   P/E        = marketCap / netIncomeTTM
      //   P/B        = marketCap / totalEquity
      //   P/S        = marketCap / revenueTTM
      //   EV/EBITDA  = (marketCap + debt - cash) / ebitdaTTM
      const marketCap = snap.shares != null && snap.shares > 0 ? price * snap.shares : null;

      // P/E: marketCap / netIncomeTTM (both on split-adjusted basis)
      const pe =
        snap.netIncomeTTM != null && snap.netIncomeTTM > 0 && marketCap != null
          ? marketCap / snap.netIncomeTTM
          : null;

      // EV/EBITDA
      let evEbitda: number | null = null;
      if (snap.ebitdaTTM && snap.ebitdaTTM > 0 && marketCap) {
        const ev = marketCap + (snap.totalDebt ?? 0) - (snap.cash ?? 0);
        evEbitda = ev / snap.ebitdaTTM;
      }

      // P/B: marketCap / totalEquity avoids BVPS split-basis mismatch
      const pb =
        snap.totalEquity != null && snap.totalEquity > 0 && marketCap != null
          ? marketCap / snap.totalEquity
          : null;

      // P/S
      const ps = snap.revenueTTM && marketCap ? marketCap / snap.revenueTTM : null;

      // Net Debt / EBITDA
      let netDebtToEbitda: number | null = null;
      if (snap.ebitdaTTM && snap.ebitdaTTM > 0) {
        const netDebt = (snap.totalDebt ?? 0) - (snap.cash ?? 0);
        netDebtToEbitda = netDebt / snap.ebitdaTTM;
      }

      // Margins
      const grossMargin =
        snap.revenueTTM && snap.grossProfitTTM ? snap.grossProfitTTM / snap.revenueTTM : null;
      const operatingMargin =
        snap.revenueTTM && snap.operatingIncomeTTM
          ? snap.operatingIncomeTTM / snap.revenueTTM
          : null;
      const netMargin =
        snap.revenueTTM && snap.netIncomeTTM ? snap.netIncomeTTM / snap.revenueTTM : null;
      const roe =
        snap.totalEquity && snap.totalEquity !== 0 && snap.netIncomeTTM != null
          ? snap.netIncomeTTM / snap.totalEquity
          : null;
      const debtToEquity =
        snap.totalEquity && snap.totalEquity !== 0 && snap.totalDebt != null
          ? snap.totalDebt / snap.totalEquity
          : null;

      result.push({
        date: pricePoint.date,
        price,
        pe,
        evEbitda,
        pb,
        ps,
        netDebtToEbitda,
        revenueTTM: snap.revenueTTM,
        netIncomeTTM: snap.netIncomeTTM,
        ebitdaTTM: snap.ebitdaTTM,
        fcfTTM: snap.fcfTTM,
        roe,
        grossMargin,
        operatingMargin,
        netMargin,
        debtToEquity,
      });
    }

    return result;
  } catch (e) {
    console.error(`[edgar] Failed to fetch dynamic ratios for ${ticker}:`, e);
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find the most recent value in a map where the key (date string) <= targetDate. */
function findLatestBefore(map: Map<string, number>, targetDate: string): number | null {
  let best: string | null = null;
  for (const key of map.keys()) {
    if (key <= targetDate) {
      if (best === null || key > best) {
        best = key;
      }
    }
  }
  return best !== null ? (map.get(best) ?? null) : null;
}
