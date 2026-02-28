import { FinancialData, DCFDetails } from '@/types';

const DEFAULT_WACC = 0.10;
const TERMINAL_GROWTH_RATE = 0.025;
const PROJECTION_YEARS = 2;

export function calculateDCF(
  financials: FinancialData[],
  currentPrice: number,
  sharesOutstanding: number,
  beta?: number,
): DCFDetails | null {
  if (financials.length < 2) return null;

  // Get historical FCF
  const fcfValues = financials
    .filter((f) => f.freeCashFlow != null && f.freeCashFlow > 0)
    .map((f) => f.freeCashFlow!);

  if (fcfValues.length < 2) return null;

  const latestFCF = fcfValues[0];

  // Estimate growth rate from historical data
  const growthRates: number[] = [];
  for (let i = 0; i < fcfValues.length - 1; i++) {
    if (fcfValues[i + 1] > 0) {
      growthRates.push((fcfValues[i] - fcfValues[i + 1]) / fcfValues[i + 1]);
    }
  }

  let growthRate = growthRates.length > 0
    ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length
    : 0.05;

  // Cap growth rate between -10% and 30%
  growthRate = Math.max(-0.10, Math.min(0.30, growthRate));

  // Estimate WACC
  const wacc = estimateWACC(financials, beta);

  // Project FCF
  const projectedFCF: number[] = [];
  let lastFCF = latestFCF;
  for (let i = 0; i < PROJECTION_YEARS; i++) {
    // Decay growth rate toward terminal rate
    const yearGrowth = growthRate - (growthRate - TERMINAL_GROWTH_RATE) * (i / (PROJECTION_YEARS + 3));
    lastFCF = lastFCF * (1 + yearGrowth);
    projectedFCF.push(lastFCF);
  }

  // Terminal value (Gordon Growth Model)
  const terminalFCF = lastFCF * (1 + TERMINAL_GROWTH_RATE);
  const terminalValue = terminalFCF / (wacc - TERMINAL_GROWTH_RATE);

  // Discount to present value
  let enterpriseValue = 0;
  for (let i = 0; i < projectedFCF.length; i++) {
    enterpriseValue += projectedFCF[i] / Math.pow(1 + wacc, i + 1);
  }
  enterpriseValue += terminalValue / Math.pow(1 + wacc, PROJECTION_YEARS);

  // Get net debt
  const latestFinancial = financials[0];
  const totalDebt = latestFinancial.totalDebt || 0;
  const cash = 0; // Simplified: could fetch cash from balance sheet

  const equityValue = enterpriseValue - totalDebt + cash;
  const fairValuePerShare = sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0;

  return {
    projectedFCF,
    terminalValue,
    wacc,
    growthRate,
    terminalGrowthRate: TERMINAL_GROWTH_RATE,
    enterpriseValue,
    equityValue,
    fairValuePerShare: Math.max(0, fairValuePerShare),
  };
}

function estimateWACC(financials: FinancialData[], beta?: number): number {
  const riskFreeRate = 0.043; // ~10Y US Treasury
  const marketPremium = 0.055; // Historical equity risk premium
  const effectiveBeta = beta || 1.0;

  // Cost of equity (CAPM)
  const costOfEquity = riskFreeRate + effectiveBeta * marketPremium;

  // Cost of debt (estimate from interest expense / total debt)
  const costOfDebt = 0.05; // Simplified estimate
  const taxRate = 0.21; // US corporate tax rate

  // Capital structure
  const latest = financials[0];
  const debt = latest?.totalDebt || 0;
  const equity = latest?.totalEquity || 1;
  const totalCapital = debt + Math.abs(equity);

  if (totalCapital === 0) return DEFAULT_WACC;

  const debtWeight = debt / totalCapital;
  const equityWeight = Math.abs(equity) / totalCapital;

  const wacc = equityWeight * costOfEquity + debtWeight * costOfDebt * (1 - taxRate);

  // Ensure WACC is reasonable (between 5% and 20%)
  return Math.max(0.05, Math.min(0.20, wacc));
}
