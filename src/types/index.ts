export interface CompanyProfile {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  exchange: string;
  price: number;
  description?: string;
  website?: string;
  ceo?: string;
  employees?: number;
  country?: string;
  ipoDate?: string;
  image?: string;
  beta?: number;
}

export interface FinancialData {
  period: string;
  periodDate?: string;
  revenue: number | null;
  netIncome: number | null;
  freeCashFlow: number | null;
  totalDebt: number | null;
  totalEquity: number | null;
  totalAssets: number | null;
  pe: number | null;
  evEbitda: number | null;
  pb: number | null;
  ps: number | null;
  roe: number | null;
  roic: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  dividendYield: number | null;
  ebitda: number | null;
  eps: number | null;
  bookValuePerShare: number | null;
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
}

/** A single point in a dynamic time series combining price + financial data */
export interface DynamicRatioPoint {
  date: string;           // YYYY-MM-DD
  price: number | null;
  pe: number | null;
  evEbitda: number | null;
  pb: number | null;
  ps: number | null;
  netDebtToEbitda: number | null;
  // TTM absolute values (for context)
  revenueTTM: number | null;
  netIncomeTTM: number | null;
  ebitdaTTM: number | null;
  fcfTTM: number | null;
  // Latest snapshot values
  roe: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
}

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ValuationResult {
  currentPrice: number;
  dcfValue: number | null;
  multiplesValue: number | null;
  compositeValue: number;
  upsidePercent: number;
  rating: 'undervalued' | 'fair' | 'overvalued';
  confidence: number;
  details: {
    dcf?: DCFDetails;
    multiples?: MultiplesDetails;
  };
}

export interface DCFDetails {
  projectedFCF: number[];
  terminalValue: number;
  wacc: number;
  growthRate: number;
  terminalGrowthRate: number;
  enterpriseValue: number;
  equityValue: number;
  fairValuePerShare: number;
}

export interface MultiplesDetails {
  peValuation: number | null;
  evEbitdaValuation: number | null;
  pbValuation: number | null;
  psValuation: number | null;
  sectorMedians: {
    pe: number | null;
    evEbitda: number | null;
    pb: number | null;
    ps: number | null;
  };
  averageValuation: number;
}

export interface PortfolioPosition {
  ticker: string;
  name: string;
  sector: string;
  weight: number;
  currentPrice: number;
  fairValue: number;
  upsidePercent: number;
  rating: string;
  rationale: string;
}

export interface PortfolioSuggestion {
  positions: PortfolioPosition[];
  totalExpectedReturn: number;
  sectorBreakdown: Record<string, number>;
  aiSummary?: string;
}

export interface AIAnalysis {
  executiveSummary: string;
  strengths: string[];
  weaknesses: string[];
  catalysts: string[];
  risks: string[];
  ratioInterpretation: string;
  outlook: string;
}

export interface SectorData {
  sector: string;
  companies: number;
  avgUpside: number;
  avgPE: number | null;
  avgROE: number | null;
  topPick: string | null;
}
