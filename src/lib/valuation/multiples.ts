import { FinancialData, MultiplesDetails } from '@/types';
import { DynamicSectorMedians } from './sector-averages';

// Sector median multiples (approximate)
const SECTOR_MEDIANS: Record<string, { pe: number; evEbitda: number; pb: number; ps: number }> = {
  'Technology': { pe: 30, evEbitda: 20, pb: 6, ps: 6 },
  'Healthcare': { pe: 22, evEbitda: 15, pb: 4, ps: 4 },
  'Financial Services': { pe: 13, evEbitda: 10, pb: 1.5, ps: 3 },
  'Consumer Cyclical': { pe: 20, evEbitda: 12, pb: 3, ps: 1.5 },
  'Consumer Defensive': { pe: 22, evEbitda: 14, pb: 4, ps: 2 },
  'Industrials': { pe: 20, evEbitda: 13, pb: 3, ps: 2 },
  'Energy': { pe: 10, evEbitda: 6, pb: 1.5, ps: 1 },
  'Utilities': { pe: 18, evEbitda: 12, pb: 2, ps: 2.5 },
  'Real Estate': { pe: 35, evEbitda: 20, pb: 2, ps: 6 },
  'Basic Materials': { pe: 14, evEbitda: 8, pb: 2, ps: 1.5 },
  'Communication Services': { pe: 18, evEbitda: 10, pb: 3, ps: 3 },
};

const DEFAULT_MEDIANS = { pe: 20, evEbitda: 12, pb: 3, ps: 2.5 };

export function calculateMultiplesValuation(
  financials: FinancialData[],
  currentPrice: number,
  sector: string,
  marketCap?: number,
  dynamicSectorMedians?: DynamicSectorMedians | null,
): MultiplesDetails | null {
  if (financials.length === 0 || currentPrice <= 0) return null;

  const latest = financials[0];
  const hardcoded = SECTOR_MEDIANS[sector] || DEFAULT_MEDIANS;

  // Prefer dynamic medians over hardcoded when available
  const medians = {
    pe: dynamicSectorMedians?.pe ?? hardcoded.pe,
    evEbitda: dynamicSectorMedians?.evEbitda ?? hardcoded.evEbitda,
    pb: dynamicSectorMedians?.pb ?? hardcoded.pb,
    ps: dynamicSectorMedians?.ps ?? hardcoded.ps,
  };

  // Estimate shares outstanding
  const sharesOutstanding = marketCap && currentPrice > 0 ? marketCap / currentPrice : 0;

  const valuations: number[] = [];

  // P/E valuation: fair price = EPS * sector median P/E
  let peValuation: number | null = null;
  if (latest.eps && latest.eps > 0) {
    peValuation = latest.eps * medians.pe;
    valuations.push(peValuation);
  }

  // EV/EBITDA valuation: fair EV = EBITDA * median multiple, convert to per-share
  let evEbitdaValuation: number | null = null;
  if (latest.ebitda && latest.ebitda > 0 && sharesOutstanding > 0) {
    const ebitdaPerShare = latest.ebitda / sharesOutstanding;
    const debtPerShare = (latest.totalDebt || 0) / sharesOutstanding;
    evEbitdaValuation = ebitdaPerShare * medians.evEbitda - debtPerShare;
    if (isFinite(evEbitdaValuation) && evEbitdaValuation > 0) {
      valuations.push(evEbitdaValuation);
    } else {
      evEbitdaValuation = null;
    }
  }

  // P/B valuation: fair price = BVPS * sector median P/B
  let pbValuation: number | null = null;
  if (latest.bookValuePerShare && latest.bookValuePerShare > 0) {
    pbValuation = latest.bookValuePerShare * medians.pb;
    valuations.push(pbValuation);
  }

  // P/S valuation: fair price = Revenue per share * sector median P/S
  let psValuation: number | null = null;
  if (latest.revenue && latest.revenue > 0 && sharesOutstanding > 0) {
    const revenuePerShare = latest.revenue / sharesOutstanding;
    psValuation = revenuePerShare * medians.ps;
    if (isFinite(psValuation) && psValuation > 0) {
      valuations.push(psValuation);
    } else {
      psValuation = null;
    }
  }

  if (valuations.length === 0) return null;

  // Also consider historical average multiples for the company
  const historicalPE = financials
    .filter((f) => f.pe != null && f.pe > 0 && f.pe < 100)
    .map((f) => f.pe!);

  if (historicalPE.length >= 2 && latest.eps && latest.eps > 0) {
    const avgPE = historicalPE.reduce((a, b) => a + b, 0) / historicalPE.length;
    valuations.push(latest.eps * avgPE);
  }

  // Historical average EV/EBITDA
  const historicalEvEbitdaValues = financials
    .filter((f) => f.evEbitda != null && f.evEbitda > 0 && f.evEbitda < 100)
    .map((f) => f.evEbitda!);

  const historicalAvgEvEbitda = historicalEvEbitdaValues.length >= 2
    ? historicalEvEbitdaValues.reduce((a, b) => a + b, 0) / historicalEvEbitdaValues.length
    : null;

  if (historicalAvgEvEbitda && latest.ebitda && latest.ebitda > 0 && sharesOutstanding > 0) {
    const ebitdaPerShare = latest.ebitda / sharesOutstanding;
    const debtPerShare = (latest.totalDebt || 0) / sharesOutstanding;
    const histEvEbitdaVal = ebitdaPerShare * historicalAvgEvEbitda - debtPerShare;
    if (isFinite(histEvEbitdaVal) && histEvEbitdaVal > 0) {
      valuations.push(histEvEbitdaVal);
    }
  }

  const averageValuation = valuations.reduce((a, b) => a + b, 0) / valuations.length;

  return {
    peValuation,
    evEbitdaValuation,
    pbValuation,
    psValuation,
    sectorMedians: {
      pe: medians.pe,
      evEbitda: medians.evEbitda,
      pb: medians.pb,
      ps: medians.ps,
    },
    dynamicSectorMedians: dynamicSectorMedians
      ? { ...dynamicSectorMedians }
      : undefined,
    historicalAvgEvEbitda,
    historicalEvEbitdaValues,
    averageValuation,
  };
}
