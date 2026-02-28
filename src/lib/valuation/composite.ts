import { FinancialData, ValuationResult } from '@/types';
import { calculateDCF } from './dcf';
import { calculateMultiplesValuation } from './multiples';
import { DynamicSectorMedians } from './sector-averages';

const DCF_WEIGHT = 0.5;
const MULTIPLES_WEIGHT = 0.5;
const MARGIN_OF_SAFETY = 0.15; // 15%

export function calculateCompositeValuation(
  financials: FinancialData[],
  currentPrice: number,
  sector: string,
  marketCap: number,
  beta?: number,
  dynamicSectorMedians?: DynamicSectorMedians | null,
): ValuationResult {
  // Estimate shares outstanding
  const sharesOutstanding = currentPrice > 0 ? marketCap / currentPrice : 0;

  // DCF valuation
  const dcfResult = calculateDCF(financials, currentPrice, sharesOutstanding, beta);
  const dcfValue = dcfResult?.fairValuePerShare || null;

  // Multiples valuation
  const multiplesResult = calculateMultiplesValuation(financials, currentPrice, sector, marketCap, dynamicSectorMedians);
  const multiplesValue = multiplesResult?.averageValuation || null;

  // Composite value
  let compositeValue: number;
  if (dcfValue && multiplesValue) {
    compositeValue = dcfValue * DCF_WEIGHT + multiplesValue * MULTIPLES_WEIGHT;
  } else if (dcfValue) {
    compositeValue = dcfValue;
  } else if (multiplesValue) {
    compositeValue = multiplesValue;
  } else {
    compositeValue = currentPrice; // No valuation possible
  }

  // Apply margin of safety for rating
  const upsidePercent = currentPrice > 0
    ? ((compositeValue - currentPrice) / currentPrice) * 100
    : 0;

  let rating: 'undervalued' | 'fair' | 'overvalued';
  if (upsidePercent > MARGIN_OF_SAFETY * 100) {
    rating = 'undervalued';
  } else if (upsidePercent < -MARGIN_OF_SAFETY * 100) {
    rating = 'overvalued';
  } else {
    rating = 'fair';
  }

  // Confidence based on data availability
  let confidence = 0.5;
  if (dcfValue && multiplesValue) confidence = 0.8;
  if (financials.length >= 4) confidence += 0.1;
  if (dcfResult && multiplesResult && multiplesResult.peValuation && multiplesResult.pbValuation) {
    confidence += 0.1;
  }
  confidence = Math.min(1, confidence);

  return {
    currentPrice,
    dcfValue,
    multiplesValue,
    compositeValue,
    upsidePercent,
    rating,
    confidence,
    details: {
      dcf: dcfResult || undefined,
      multiples: multiplesResult || undefined,
    },
  };
}
