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
    // Revenue fallback chain (Fix D): lower-priority tags listed first so
    // higher-priority tags overwrite in the merged map.
    const revenueMap = extractWithFallback(facts, [
      'SalesRevenueGoodsNet',
      'SalesRevenueServicesNet',
      'InterestAndDividendIncomeOperating',
      'RevenuesNetOfInterestExpense',
      'Revenues',
      'SalesRevenueNet',
      'RevenueFromContractWithCustomerExcludingAssessedTax',
    ]);
    // Net income fallback chain (annual):
    //   1. NetIncomeLoss (primary — most companies)
    //   2. ProfitLoss (some companies, especially early filings or non-US reporters)
    //   3. NetIncomeLossAvailableToCommonStockholdersBasic (companies with preferred stock)
    //   4. IncomeLossFromContinuingOperations (companies that report discontinued ops separately)
    const netIncomeMap = extractWithFallback(facts, [
      'IncomeLossFromContinuingOperations',
      'NetIncomeLossAvailableToCommonStockholdersBasic',
      'ProfitLoss',
      'NetIncomeLoss',
    ]);
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
  start: string;   // period start date (YYYY-MM-DD); used to detect genuine annual periods
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
      start: p.start ?? '',
      filed: p.filed ?? '',
      val: Number(p.val),
      fp: p.fp ?? '',
      form: p.form,
    }));
}

/** Extract balance sheet points from the DEI (Document and Entity Information) namespace. */
function extractDeiBalanceSheetPoints(facts: any, tagName: string): Map<string, number> {
  const result = new Map<string, number>();
  const dei = facts?.facts?.['dei'];
  if (!dei) return result;

  const tag = dei[tagName];
  if (!tag?.units) return result;

  const unitKeys = Object.keys(tag.units);
  const preferredUnit =
    unitKeys.find((u) => u === 'USD') ??
    unitKeys.find((u) => u === 'shares') ??
    unitKeys[0];

  if (!preferredUnit) return result;

  const dataPoints: any[] = tag.units[preferredUnit] ?? [];

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
 * Like extractBalanceSheetPoints but also returns the filing date for each end date.
 * This is needed for share counts so we can determine whether a later refiling has
 * already retroactively applied post-split share adjustments.
 */
function extractBalanceSheetPointsWithFilingDate(
  facts: any,
  tagName: string
): Map<string, { val: number; filed: string }> {
  const result = new Map<string, { val: number; filed: string }>();
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
    result.set(endDate, { val: Number(p.val), filed: p.filed ?? '' });
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
 *
 * Grouping strategy: we group by the FY endpoint, not by calendar year.
 * This correctly handles companies whose fiscal year straddles calendar years
 * (e.g. Costco, whose FY ends in August/September so Q1 falls in November of
 * the prior calendar year). Grouping by calendar year would split the quarters
 * across two buckets and destroy the YTD subtraction chain.
 *
 * FP-label corruption: EDGAR 10-K filings sometimes re-report comparative
 * quarter dates with fp="FY" (instead of Q1/Q2/Q3). To prevent these
 * mislabelled points from clobbering the correct quarterly values, we prefer
 * the 10-Q filing's fp label over the 10-K's when both cover the same date.
 */
function isolateQuarters(points: QuarterPoint[]): Map<string, number> {
  // ── Step 1: collect all FY (annual) endpoints ─────────────────────────────
  // An FY point is one whose fp==="FY" (or fp==="Q4" in some 10-K filings that
  // mislabel the annual total) AND it came from a 10-K/10-K/A filing.
  // We use these as the "anchor" for each fiscal year group.
  //
  // Distinguishing genuine annual anchors from mislabelled quarterly comparatives:
  // EDGAR 10-K filings sometimes include comparative restated data for prior
  // quarters labelled with fp="FY" (instead of Q1/Q2/Q3). The key distinguisher
  // is the period length: a genuine annual report spans ~340-370 days, while a
  // mislabelled quarterly entry spans only ~80-100 days.
  //
  // We use the `start` date (when available) to compute the period length.
  // If `start` is missing we fall back to accepting any fp=FY/Q4 10-K entry.
  // This approach also correctly handles multi-year 10-K filings (e.g. a company
  // that first files on EDGAR with 3 years of data in a single submission) without
  // discarding the earlier years.
  const ANNUAL_MIN_DAYS = 270; // ~9 months: shorter than this → not a full-year period

  const fyPoints = points.filter((p) => {
    if (p.form !== '10-K' && p.form !== '10-K/A') return false;
    if (p.fp !== 'FY' && p.fp !== 'Q4') return false;
    // If start date is available, require the period to span at least ANNUAL_MIN_DAYS.
    if (p.start) {
      const startMs = Date.parse(p.start);
      const endMs = Date.parse(p.end);
      if (!isNaN(startMs) && !isNaN(endMs)) {
        const days = (endMs - startMs) / 86_400_000;
        if (days < ANNUAL_MIN_DAYS) return false; // short span → mislabelled quarterly
      }
    }
    return true;
  });

  // Build the canonical FY anchors: deduplicate by end date, keeping most
  // recently filed (in case multiple filings cover the same period end).
  const fyByEnd = new Map<string, QuarterPoint>();
  for (const p of fyPoints) {
    const ex = fyByEnd.get(p.end);
    if (!ex || p.filed > ex.filed) fyByEnd.set(p.end, p);
  }

  // Sort FY anchors ascending by end date.
  const sortedFYEnds = Array.from(fyByEnd.keys()).sort();

  // ── Step 2: for each fiscal year, collect its Q1/Q2/Q3 quarterly points ───
  // A quarterly point belongs to FY[i] if its end date falls in the window
  // (prevFYEnd, thisFYEnd].  We only accept points with fp ∈ {Q1,Q2,Q3,FY}.
  //
  // Dedup rule per (end-date, fp) pair: prefer the 10-Q form over a 10-K
  // (10-K comparative restated rows often mislabel quarterly dates as fp=FY).
  // Among same-form entries, keep the most recently filed.

  // Build a clean map: (endDate, fp) → best point, preferring 10-Q form.
  //
  // Deduplication priority for entries with the same (end, fp) key:
  //   1. Prefer 10-Q form over 10-K (avoids fp=FY mislabels on 10-K restated comparatives).
  //   2. Among same-form entries, prefer EARLIER start date (earlier start = longer YTD
  //      period = cumulative-YTD value). This is critical for companies like CTSH and CRM
  //      that tag BOTH the period-cumulative-YTD value (start=FY_start) AND the
  //      period-standalone value (start=prior_quarter_end) for the same (end, fp) in the
  //      same 10-Q filing. isolateQuarters expects YTD-cumulative values and subtracts
  //      prior quarters; using the standalone value causes incorrect (often negative)
  //      quarter isolations that break P/E and other TTM ratios.
  //   3. Among same-form/same-start entries, prefer most-recently-filed.
  const cleanByEndFP = new Map<string, QuarterPoint>();
  for (const p of points) {
    const key = `${p.end}|${p.fp}`;
    const ex = cleanByEndFP.get(key);
    if (!ex) {
      cleanByEndFP.set(key, p);
    } else {
      // Prefer 10-Q over 10-K for quarterly periods (avoids fp=FY mislabels).
      const pIsQ = p.form === '10-Q';
      const exIsQ = ex.form === '10-Q';
      if (pIsQ && !exIsQ) {
        cleanByEndFP.set(key, p);
      } else if (!pIsQ && exIsQ) {
        // keep existing 10-Q
      } else {
        // Same form type: prefer EARLIER start date (longer span = YTD cumulative).
        // An earlier start means the period is longer (e.g. 9-months YTD vs 3-months
        // standalone). isolateQuarters needs the YTD value to correctly subtract.
        const pStart = p.start ?? '';
        const exStart = ex.start ?? '';
        if (pStart < exStart) {
          // p has earlier start (longer period = more likely to be YTD) → prefer p
          cleanByEndFP.set(key, p);
        } else if (pStart > exStart) {
          // ex has earlier start → keep ex
        } else {
          // Same start date: prefer most recently filed
          if (p.filed > ex.filed) {
            cleanByEndFP.set(key, p);
          }
        }
      }
    }
  }

  const result = new Map<string, number>(); // end date → single-quarter value

  for (let i = 0; i < sortedFYEnds.length; i++) {
    const fyEnd = sortedFYEnds[i];
    const prevFYEnd = i > 0 ? sortedFYEnds[i - 1] : '';
    const fyPoint = fyByEnd.get(fyEnd)!;

    // Collect all quarterly (Q1/Q2/Q3) points for this fiscal year window.
    // A point belongs here if: its end date is in (prevFYEnd, fyEnd] and
    // its fp is Q1, Q2, or Q3 (or FY — but we use the anchor for FY).
    const windowPoints: QuarterPoint[] = [];
    for (const [, p] of cleanByEndFP.entries()) {
      if (p.end > prevFYEnd && p.end <= fyEnd && (p.fp === 'Q1' || p.fp === 'Q2' || p.fp === 'Q3')) {
        windowPoints.push(p);
      }
    }

    // Deduplicate by fp within the window.
    // Priority: prefer LATER end date (real Q3 ends later than a mislabeled-Q3 covering
    // an earlier quarter). Use most-recently-filed as tiebreaker for same end date.
    // This prevents re-filings that mislabel standalone values with the wrong fp label
    // from overriding the correct quarterly data (e.g. CTSH re-files Q2 standalone as
    // fp=Q3 in later 10-Qs, which should not replace the real Q3 at a later end date).
    const byFP = new Map<string, QuarterPoint>();
    for (const p of windowPoints) {
      const ex = byFP.get(p.fp);
      if (!ex) {
        byFP.set(p.fp, p);
      } else if (p.end > ex.end) {
        // Later end date wins (the real Q3 ends after a mislabeled Q3 covering Q2 period)
        byFP.set(p.fp, p);
      } else if (p.end === ex.end && p.filed > ex.filed) {
        // Same end date: most recently filed wins
        byFP.set(p.fp, p);
      }
    }

    const q1 = byFP.get('Q1');
    const q2 = byFP.get('Q2');
    const q3 = byFP.get('Q3');
    const fy = fyPoint;

    if (q1) result.set(q1.end, q1.val);
    if (q2 && q1) result.set(q2.end, q2.val - q1.val);
    else if (q2) result.set(q2.end, q2.val);
    if (q3 && q2) result.set(q3.end, q3.val - q2.val);
    else if (q3) result.set(q3.end, q3.val);
    // Q4 = Annual - Q3_YTD.  Only emit if we have Q3; without it we cannot
    // reliably isolate Q4 (the fallback of using the full annual as a single
    // quarter inflates TTM by ~3× and must be avoided).
    if (fy && q3) result.set(fy.end, fy.val - q3.val);
    // If there is no Q3 we skip the FY row entirely to avoid TTM distortion.
  }

  // ── Step 3: trailing quarters after the last FY anchor ───────────────────
  // The most recent fiscal year may still be in progress (no FY 10-K filed yet).
  // Any Q1/Q2/Q3 with end date > lastFYEnd belong to this open group.
  // We include them using the same YTD subtraction chain so that the current
  // TTM calculation can include the most recently reported quarter.
  if (sortedFYEnds.length > 0) {
    const lastFYEnd = sortedFYEnds[sortedFYEnds.length - 1];

    // Collect trailing Q1/Q2/Q3 points after the last FY anchor.
    const trailingPoints: QuarterPoint[] = [];
    for (const [, p] of cleanByEndFP.entries()) {
      if (p.end > lastFYEnd && (p.fp === 'Q1' || p.fp === 'Q2' || p.fp === 'Q3')) {
        trailingPoints.push(p);
      }
    }

    // Deduplicate by fp, keeping most recently filed.
    const trailingByFP = new Map<string, QuarterPoint>();
    for (const p of trailingPoints) {
      const ex = trailingByFP.get(p.fp);
      if (!ex || p.filed > ex.filed) trailingByFP.set(p.fp, p);
    }

    const tq1 = trailingByFP.get('Q1');
    const tq2 = trailingByFP.get('Q2');
    const tq3 = trailingByFP.get('Q3');

    // Q1 is always standalone (starts right after the prior FY end).
    if (tq1) result.set(tq1.end, tq1.val);
    // Q2 and Q3 are YTD: subtract the prior Q from the YTD total.
    if (tq2 && tq1) result.set(tq2.end, tq2.val - tq1.val);
    else if (tq2) result.set(tq2.end, tq2.val); // no Q1 to subtract (rare)
    if (tq3 && tq2) result.set(tq3.end, tq3.val - tq2.val);
    else if (tq3) result.set(tq3.end, tq3.val); // no Q2 to subtract (rare)
  }

  return result;
}

// ─── getEdgarDynamicRatios ────────────────────────────────────────────────────

/**
 * Build a lookup function that returns the cumulative split factor that must be
 * applied to EDGAR share counts (or per-share data) for a given period-end date
 * and filing date in order to convert them to the same fully-split-adjusted
 * basis that Yahoo Finance uses for its historical prices.
 *
 * Yahoo prices are retroactively adjusted: every historical price is divided by
 * the product of all subsequent split factors.
 *
 * EDGAR companies sometimes retroactively restate share counts in later filings
 * after a split (e.g. Amazon's 2020 10-K refiled in 2023 after the 2022 20:1 split
 * shows 10.2B shares instead of the original 510M). If we apply the full
 * cumulative split factor on top of an already-adjusted value, we double-count.
 *
 * The correct factor is:
 *   factor = product of splits whose ex-date is >= filingDate (not yet applied)
 *
 * Splits that occurred between the period end date (D) and the filing date (F)
 * have already been baked into the reported value by the company's retroactive
 * restatement. Only splits on or after F still need to be applied.
 *
 * For income statement per-share values (EPS), the same logic applies using the
 * filing date of the data point.
 *
 * @param splits  Split events sorted ascending by date (from getYahooV2SplitHistory).
 * @returns       A function (periodEndDate, filingDate) => number giving the factor.
 */
function buildCumulativeSplitFactor(
  splits: Array<{ date: string; factor: number }>
): (periodEndDate: string, filingDate?: string) => number {
  // Pre-compute suffix products: suffixProducts[i] = product of splits[i..n-1].
  const n = splits.length;
  const suffixProducts = new Array<number>(n + 1).fill(1);
  for (let i = n - 1; i >= 0; i--) {
    suffixProducts[i] = splits[i].factor * suffixProducts[i + 1];
  }

  // Binary search helper: find index of first split with date >= cutoffDate.
  function firstSplitOnOrAfter(cutoffDate: string): number {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (splits[mid].date < cutoffDate) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  // Binary search helper: find index of first split with date > periodEndDate.
  function firstSplitAfterPeriodEnd(periodEndDate: string): number {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (splits[mid].date <= periodEndDate) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  return function getCumulativeFactor(periodEndDate: string, filingDate?: string): number {
    if (!filingDate || filingDate <= periodEndDate) {
      // No filing date info or filing is contemporaneous with the period:
      // apply all splits that occurred after the period end (classic approach).
      return suffixProducts[firstSplitAfterPeriodEnd(periodEndDate)];
    }

    // Splits between periodEndDate and filingDate have already been retroactively
    // applied by the company. Only splits on/after filingDate still need applying.
    return suffixProducts[firstSplitOnOrAfter(filingDate)];
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
    // Pass all raw points from all revenue tag variants directly to isolateQuarters.
    // isolateQuarters' cleanByEndFP dedup correctly handles cross-tag conflicts by
    // preferring 10-Q form over 10-K, and more-recently-filed among same-form entries.
    // Tag priority (higher priority tags listed later so they overwrite in the merge):
    //   1. SalesRevenueGoodsNet / SalesRevenueServicesNet — older product/service splits
    //   2. RevenuesNetOfInterestExpense — banks and financial firms
    //   3. InterestAndDividendIncomeOperating — banks using interest income as revenue
    //   4. SalesRevenueNet — broad fallback
    //   5. Revenues — broad fallback
    //   6. RevenueFromContractWithCustomerExcludingAssessedTax — primary (ASC 606, 2018+)
    const revenueQtrMap = isolateQuarters([
      ...extractIncomePoints(facts, 'SalesRevenueGoodsNet'),
      ...extractIncomePoints(facts, 'SalesRevenueServicesNet'),
      ...extractIncomePoints(facts, 'InterestAndDividendIncomeOperating'),
      ...extractIncomePoints(facts, 'RevenuesNetOfInterestExpense'),
      ...extractIncomePoints(facts, 'SalesRevenueNet'),
      ...extractIncomePoints(facts, 'Revenues'),
      ...extractIncomePoints(facts, 'RevenueFromContractWithCustomerExcludingAssessedTax'),
    ]);

    // Net income fallback chain (quarterly):
    //   1. NetIncomeLoss (primary — most companies; listed first = lower priority)
    //   2. ProfitLoss (alternative tag; listed last = higher priority in cleanByEndFP dedup)
    // Note: we don't add NetIncomeLossAvailableToCommonStockholdersBasic here because it is
    // the same concept but excludes amounts attributable to noncontrolling interests; mixing
    // it with NetIncomeLoss could cause double-counting if both exist for the same period.
    // IncomeLossFromContinuingOperations is excluded from the quarterly chain for the same
    // reason — it omits discontinued operations, producing inconsistent TTM values.
    const netIncomeQtrMap = isolateQuarters([
      ...extractIncomePoints(facts, 'NetIncomeLoss'),
      ...extractIncomePoints(facts, 'ProfitLoss'),
    ]);
    const grossProfitQtrMap = isolateQuarters(extractIncomePoints(facts, 'GrossProfit'));
    // Operating income fallback chain:
    //   1. OperatingIncomeLoss (primary — most companies)
    //   2. IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest
    //      (pre-tax income — some companies use this instead of OperatingIncomeLoss)
    // Lower-priority tags are listed first so higher-priority tags overwrite in cleanByEndFP.
    const operatingIncomeQtrMap = isolateQuarters([
      ...extractIncomePoints(facts, 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest'),
      ...extractIncomePoints(facts, 'OperatingIncomeLoss'),
    ]);

    // Additional income components needed for EBITDA fallback paths (Fix B)
    const incomeTaxQtrMap = isolateQuarters(extractIncomePoints(facts, 'IncomeTaxExpenseBenefit'));
    // Interest expense: prefer InterestExpense, fall back to InterestExpenseDebt;
    // also try InterestIncomeExpenseNet (negative means expense > income).
    const interestExpenseQtrMap = isolateQuarters([
      ...extractIncomePoints(facts, 'InterestIncomeExpenseNet'),
      ...extractIncomePoints(facts, 'InterestExpenseDebt'),
      ...extractIncomePoints(facts, 'InterestExpense'),
    ]);
    const operatingCFQtrMap = isolateQuarters(
      extractIncomePoints(facts, 'NetCashProvidedByUsedInOperatingActivities')
    );
    const capexQtrMap = isolateQuarters(
      extractIncomePoints(facts, 'PaymentsToAcquirePropertyPlantAndEquipment')
    );
    // Depreciation: combine all tag variants and pass them all to isolateQuarters.
    // We do NOT pre-dedup across tags before calling isolateQuarters because that
    // outer dedup (using p.filed >= existing.filed) would incorrectly discard FY
    // anchor entries from older filings when a later 10-K re-reports prior years.
    // Instead, isolateQuarters' own internal dedup (cleanByEndFP) correctly prefers
    // 10-Q forms over 10-K forms and most-recently-filed among same-form entries.
    //
    // Tag priority (processed in order; later duplicates overwrite in cleanByEndFP
    // only if more recently filed, so the most accurate value wins naturally):
    //   1. DepreciationDepletionAndAmortization  — preferred primary tag (most companies)
    //   2. DepreciationAmortizationAndAccretionNet — alternative (some companies, banks)
    //   3. DepreciationAndAmortization             — additional fallback
    const depreciationQtrMapCombined = isolateQuarters([
      ...extractIncomePoints(facts, 'DepreciationAndAmortization'),
      ...extractIncomePoints(facts, 'DepreciationAmortizationAndAccretionNet'),
      ...extractIncomePoints(facts, 'DepreciationDepletionAndAmortization'),
    ]);

    // Fix C: Some companies (MSFT, GOOGL, ABT) report D&A as two separate line items:
    //   - Depreciation (property/equipment)
    //   - AmortizationOfIntangibleAssets (intangibles)
    // We isolate each separately, then SUM them per quarter to get total D&A.
    // This is done BEFORE the TTM summation so each quarter has the correct D&A value.
    const depreciationOnlyQtrMap = isolateQuarters(
      extractIncomePoints(facts, 'Depreciation')
    );
    const amortizationQtrMap = isolateQuarters(
      extractIncomePoints(facts, 'AmortizationOfIntangibleAssets')
    );

    // Build summed D&A map: for each quarter date where BOTH Depreciation and
    // AmortizationOfIntangibleAssets exist, store their sum as total D&A.
    const splitDAQtrMap = new Map<string, number>();
    const allSplitDADates = new Set([
      ...depreciationOnlyQtrMap.keys(),
      ...amortizationQtrMap.keys(),
    ]);
    for (const d of allSplitDADates) {
      const dep = depreciationOnlyQtrMap.get(d);
      const amort = amortizationQtrMap.get(d);
      if (dep != null && amort != null) {
        // Both components present: use the sum as total D&A for this quarter.
        splitDAQtrMap.set(d, dep + amort);
      } else if (dep != null) {
        // Only depreciation available (no amortization): use as partial D&A.
        splitDAQtrMap.set(d, dep);
      } else if (amort != null) {
        // Only amortization available: use as partial D&A.
        splitDAQtrMap.set(d, amort);
      }
    }

    // Fix D (GOOGL / companies without a tagged D&A expense):
    // Some companies (e.g. Alphabet/GOOGL before 2023) do not tag any income-statement
    // D&A line item. As a last-resort fallback, derive quarterly D&A from the CHANGE in
    // the accumulated-depreciation balance-sheet account between consecutive quarters.
    //
    // We try two balance-sheet tags (prefer the one with wider coverage):
    //   1. AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment
    //      — PP&E accumulated depreciation (GOOGL has quarterly data from 2016)
    //   2. PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAccumulatedDepreciationAndAmortization
    //      — PP&E + finance-lease accumulated DA (GOOGL has quarterly data from 2020)
    //
    // Period D&A ≈ ΔAccumulatedDepreciation = currentBalance − priorQuarterBalance.
    // This is a proxy (it is NET of asset disposals) and may underestimate gross D&A
    // when large assets are disposed of, but it is far better than null for EV/EBITDA.
    // We only use this for quarters that have NO value from the primary D&A tags.
    const accDepBS1 = extractBalanceSheetPoints(
      facts,
      'AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment'
    );
    const accDepBS2 = extractBalanceSheetPoints(
      facts,
      'PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAccumulatedDepreciationAndAmortization'
    );
    // Merge the two balance-sheet accumulated-depreciation maps.
    // Prefer tag 2 (PPE + Finance Lease) over tag 1 (PPE only) where both exist,
    // as it is the more comprehensive measure. We store both and fall back to tag 1
    // where tag 2 is unavailable.
    const accDepBS = new Map<string, number>(accDepBS1);
    for (const [k, v] of accDepBS2.entries()) accDepBS.set(k, v);

    // Derive quarterly D&A from balance-sheet deltas.
    // Sort all balance-sheet dates and compute successive differences.
    const bsDeltaDAQtrMap = new Map<string, number>();
    if (accDepBS.size >= 2) {
      const sortedBSDates = Array.from(accDepBS.keys()).sort();
      for (let i = 1; i < sortedBSDates.length; i++) {
        const curDate = sortedBSDates[i];
        const prevDate = sortedBSDates[i - 1];
        const curVal = accDepBS.get(curDate)!;
        const prevVal = accDepBS.get(prevDate)!;
        const delta = curVal - prevVal;
        // Only use positive deltas (accumulated depreciation normally increases).
        // Negative delta indicates asset disposals exceed new depreciation — skip.
        // Also skip if the gap between dates is more than ~200 days (missed quarters
        // would inflate the delta, making it multi-quarter rather than single-quarter).
        const daysBetween =
          (Date.parse(curDate) - Date.parse(prevDate)) / 86_400_000;
        if (delta > 0 && daysBetween <= 200) {
          bsDeltaDAQtrMap.set(curDate, delta);
        }
      }
    }

    // Merge D&A maps: priority order (highest priority last, overwrites earlier):
    //   1. bsDeltaDAQtrMap (balance-sheet delta; last resort, least precise)
    //   2. splitDAQtrMap (Depreciation + AmortizationOfIntangibleAssets sum)
    //   3. depreciationQtrMapCombined (combined tags like DepreciationDepletionAndAmortization)
    // The combined tag is preferred when available (more authoritative), but the
    // split sum fills in quarters where no combined tag exists, and the BS delta
    // fills in quarters where neither direct tag has data.
    const depreciationQtrMap = new Map<string, number>(bsDeltaDAQtrMap);
    for (const [k, v] of splitDAQtrMap.entries()) depreciationQtrMap.set(k, v);
    for (const [k, v] of depreciationQtrMapCombined.entries()) {
      // Combined tag wins over all fallbacks (it is the company's own reported total)
      depreciationQtrMap.set(k, v);
    }

    const epsQtrMap = isolateQuarters([
      ...extractIncomePoints(facts, 'EarningsPerShareDiluted'),
      ...extractIncomePoints(facts, 'EarningsPerShareBasic'),
    ]);

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

    // Shares: use the filing-date-aware variant so we can pass the filing date
    // to getCumulativeSplitFactor. This prevents double-counting when EDGAR
    // retroactively refiles share data with post-split-adjusted values.
    const sharesBSWithFiled = new Map<string, { val: number; filed: string }>();
    for (const [k, v] of extractBalanceSheetPointsWithFilingDate(
      facts,
      'WeightedAverageNumberOfDilutedSharesOutstanding'
    ).entries()) {
      sharesBSWithFiled.set(k, v);
    }
    for (const [k, v] of extractBalanceSheetPointsWithFilingDate(
      facts,
      'CommonStockSharesOutstanding'
    ).entries()) {
      if (!sharesBSWithFiled.has(k)) sharesBSWithFiled.set(k, v);
    }
    // Fix A (Visa): Some companies (e.g. Visa) do not tag any standard share-count
    // fields in EDGAR. As a last-resort fallback, derive an approximate share count
    // from DEI's EntityPublicFloat (USD) divided by the us-gaap SharePrice (USD/share).
    // EntityPublicFloat is the float (not total shares), so this underestimates total
    // shares slightly, but it is still far better than null.
    if (sharesBSWithFiled.size === 0) {
      const publicFloatBS = extractDeiBalanceSheetPoints(facts, 'EntityPublicFloat');
      const sharePriceBS = extractBalanceSheetPoints(facts, 'SharePrice');
      // For each EntityPublicFloat date, find the closest SharePrice
      for (const [floatDate, floatVal] of publicFloatBS.entries()) {
        const sp = findLatestBefore(sharePriceBS, floatDate);
        if (sp && sp > 0) {
          const impliedShares = floatVal / sp;
          // Use a fake filed date equal to floatDate so split factor is computed correctly
          if (!sharesBSWithFiled.has(floatDate)) {
            sharesBSWithFiled.set(floatDate, { val: impliedShares, filed: floatDate });
          }
        }
      }
    }
    // Plain map for findLatestBefore lookups (value only)
    const sharesBS = new Map<string, number>();
    for (const [k, { val }] of sharesBSWithFiled.entries()) sharesBS.set(k, val);
    // Filing date map: for each end date, the date the most-recently-filed shares were reported
    const sharesFiledDateBS = new Map<string, string>();
    for (const [k, { filed }] of sharesBSWithFiled.entries()) sharesFiledDateBS.set(k, filed);

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
      incomeTax: number | null;       // Fix B: for EBITDA fallback path
      interestExpense: number | null; // Fix B: for EBITDA fallback path
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
      // Determine the best available share count and its filing date.
      // findLatestBefore returns the most recent balance-sheet entry on or before endDate.
      // We look up the corresponding filing date to pass to getCumulativeSplitFactor,
      // which then only applies splits that happened AFTER that filing date —
      // this avoids double-counting when EDGAR retroactively adjusts share counts
      // in later filings after a stock split.
      const rawShares = findLatestBefore(sharesBS, endDate);
      const sharesFilingDate = findLatestBeforeKey(sharesFiledDateBS, endDate);

      // getCumulativeSplitFactor(periodEnd, filingDate):
      //   • If filingDate > periodEnd + any split: the filing already applied those
      //     splits retroactively; only apply splits on/after filingDate.
      //   • If filingDate <= periodEnd (or unknown): apply all splits after periodEnd.
      const splitFactor = getCumulativeSplitFactor(endDate, sharesFilingDate ?? undefined);

      // EPS: the quarterly EPS from isolateQuarters is derived from the most-recently-filed
      // 10-Q or 10-K for that quarter. EDGAR does NOT retroactively adjust per-share values
      // in the same way it adjusts share counts; instead it consistently reports historical
      // per-share values on a split-adjusted basis in each new filing.
      // We therefore apply the same split factor computed from the filing date of the shares
      // data (which is a good proxy for the EPS filing date too).
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
        // splitFactor = product of splits not yet applied in the filing, so:
        //   adjustedShares = asReportedShares × splitFactor
        //   adjustedEPS    = asReportedEPS    ÷ splitFactor
        eps: rawEps != null ? rawEps / splitFactor : null,
        // Fix B: income tax and interest expense for EBITDA fallback path
        incomeTax: incomeTaxQtrMap.get(endDate) ?? null,
        interestExpense: interestExpenseQtrMap.get(endDate) ?? null,
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

    // Helper: sum 4 values from a partial array; requires all 4 to be non-null
    // unless 'allowPartial' is true (then returns null only if all are null).
    // Standard sumField (all-4-or-null) is defined inside the loop below.

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

      // Like sumField but allows partial coverage; returns null only if ALL 4 are null.
      // Used for supplemental items (incomeTax, interestExpense) in EBITDA Path 2
      // so that a company with sparse tax/interest data still gets a reasonable estimate.
      const sumFieldPartial = (field: keyof FinSnapshot): number | null => {
        const vals = q
          .map((s) => s[field] as number | null)
          .filter((v): v is number => v != null);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
      };

      const revenueTTM = sumField('revenue');
      const netIncomeTTM = sumField('netIncome');
      const operatingIncomeTTM = sumField('operatingIncome');
      const depreciationTTM = sumField('depreciation');
      const operatingCFTTM = sumField('operatingCF');
      const capexTTM = sumField('capex');
      const grossProfitTTM = sumField('grossProfit');
      const epsTTM = sumField('eps');
      // Use partial sums for tax/interest: they may not be present in all 4 quarters
      // but we still want a reasonable EBITDA estimate for Path 2.
      const incomeTaxTTM = sumFieldPartial('incomeTax');
      const interestExpenseTTM = sumFieldPartial('interestExpense');

      // EBITDA calculation with fallback paths (Fix B):
      //   Path 1: OperatingIncome + D&A (primary — standard approach)
      //   Path 2: NetIncome + IncomeTax + InterestExpense + D&A
      //           (when OperatingIncomeLoss is missing but individual components exist)
      // Note: InterestIncomeExpenseNet is reported as negative when expense > income,
      // so we negate it to get the expense amount when used in this path.
      let ebitdaTTM: number | null = null;
      if (operatingIncomeTTM != null && depreciationTTM != null) {
        // Path 1 (preferred)
        ebitdaTTM = operatingIncomeTTM + depreciationTTM;
      } else if (netIncomeTTM != null && depreciationTTM != null) {
        // Path 2: EBIT = NetIncome + Tax + Interest, then EBITDA = EBIT + D&A
        // IncomeTaxExpenseBenefit is positive for tax expense, so add it.
        // InterestExpense is positive when reported as expense (negative for net interest income).
        // We add interestExpenseTTM directly; if it came from InterestIncomeExpenseNet
        // (which is negative for net expense), we negate so positive = expense added back.
        const taxAdd = incomeTaxTTM ?? 0;
        // Interest: if the value came from InterestIncomeExpenseNet, a negative value
        // means net expense; negate to make it a positive add-back.
        // If it came from InterestExpense or InterestExpenseDebt, it is already positive.
        // We detect sign by checking if adding it makes EBITDA larger (positive add-back).
        // Simpler heuristic: always add interestExpenseTTM as-is (InterestExpense tags are
        // positive; InterestIncomeExpenseNet is negative-when-expense, so we negate).
        // Since we layered the tags with InterestExpense winning over InterestIncomeExpenseNet,
        // the value should be positive (an expense). Use it directly.
        const intAdd = interestExpenseTTM != null ? Math.abs(interestExpenseTTM) : 0;
        ebitdaTTM = netIncomeTTM + taxAdd + intAdd + depreciationTTM;
      }
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

      // ── Ratio sanity bounds ────────────────────────────────────────────────
      // Ratios beyond these bounds are almost certainly data errors (wrong quarter
      // isolation, split-adjustment bugs, extreme one-time charges, etc.) and are
      // set to null to avoid misleading chart spikes.
      //
      // Legitimate extreme cases (e.g. near-zero but positive earnings during a
      // crisis, or AMZN in its near-zero-profit years) are handled by the null
      // thresholds: P/E for genuinely high-growth/low-profit companies can reach
      // 200-400 during certain periods but the >500 threshold avoids chart artifacts
      // while preserving most real high-PE scenarios.
      const RATIO_MAX = 500;   // Absolute maximum for P/E, EV/EBITDA, P/B, P/S
      const sanity = (v: number | null): number | null =>
        v != null && isFinite(v) && Math.abs(v) <= RATIO_MAX ? v : null;

      // P/E: marketCap / netIncomeTTM (both on split-adjusted basis)
      // Null when earnings are negative (P/E is meaningless for loss-making companies).
      const peRaw =
        snap.netIncomeTTM != null && snap.netIncomeTTM > 0 && marketCap != null
          ? marketCap / snap.netIncomeTTM
          : null;
      const pe = sanity(peRaw);

      // EV/EBITDA
      let evEbitda: number | null = null;
      if (snap.ebitdaTTM && snap.ebitdaTTM > 0 && marketCap) {
        const ev = marketCap + (snap.totalDebt ?? 0) - (snap.cash ?? 0);
        evEbitda = sanity(ev / snap.ebitdaTTM);
      }

      // P/B: marketCap / totalEquity avoids BVPS split-basis mismatch.
      // Null when equity is negative (book value is negative for some companies).
      const pbRaw =
        snap.totalEquity != null && snap.totalEquity > 0 && marketCap != null
          ? marketCap / snap.totalEquity
          : null;
      const pb = sanity(pbRaw);

      // P/S
      const psRaw = snap.revenueTTM && marketCap ? marketCap / snap.revenueTTM : null;
      const ps = sanity(psRaw);

      // Net Debt / EBITDA
      let netDebtToEbitda: number | null = null;
      if (snap.ebitdaTTM && snap.ebitdaTTM > 0) {
        const netDebt = (snap.totalDebt ?? 0) - (snap.cash ?? 0);
        const raw = netDebt / snap.ebitdaTTM;
        // Net Debt/EBITDA can legitimately be negative (net cash position) or high for
        // leveraged companies; cap at ±50 to avoid data artifacts.
        netDebtToEbitda = isFinite(raw) && Math.abs(raw) <= 50 ? raw : null;
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

/**
 * Find the most recent value in a string-value map where the key (date string) <= targetDate.
 * Used to retrieve filing dates alongside balance sheet values.
 */
function findLatestBeforeKey<T>(map: Map<string, T>, targetDate: string): T | null {
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
