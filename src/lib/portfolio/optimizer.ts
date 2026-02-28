import prisma from '@/lib/db';
import { PortfolioPosition, PortfolioSuggestion } from '@/types';

const MAX_POSITIONS = 20;
const MIN_POSITIONS = 10;
const MAX_SECTOR_WEIGHT = 0.30; // 30% max per sector
const MIN_UPSIDE = 5; // At least 5% upside

interface ScoredCompany {
  ticker: string;
  name: string;
  sector: string;
  currentPrice: number;
  compositeValue: number;
  upsidePercent: number;
  qualityScore: number;
}

export async function generateOptimalPortfolio(): Promise<PortfolioSuggestion> {
  // Get all companies with valuations
  const companies = await prisma.company.findMany({
    include: {
      valuations: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
      financials: {
        orderBy: { period: 'desc' },
        take: 1,
      },
    },
  });

  // Score and filter companies
  const scored: ScoredCompany[] = companies
    .filter((c) => {
      const v = c.valuations[0];
      return v && v.upsidePercent > MIN_UPSIDE && (v.rating === 'undervalued' || v.rating === 'fair');
    })
    .map((c) => {
      const v = c.valuations[0];
      const f = c.financials[0];

      // Quality score: ROE, margins, growth, low debt
      let qualityScore = 0;
      if (f) {
        if (f.roe && f.roe > 0.15) qualityScore += 2;
        else if (f.roe && f.roe > 0.10) qualityScore += 1;

        if (f.netMargin && f.netMargin > 0.15) qualityScore += 2;
        else if (f.netMargin && f.netMargin > 0.05) qualityScore += 1;

        if (f.revenueGrowth && f.revenueGrowth > 0.10) qualityScore += 2;
        else if (f.revenueGrowth && f.revenueGrowth > 0) qualityScore += 1;

        if (f.debtToEquity != null && f.debtToEquity < 0.5) qualityScore += 2;
        else if (f.debtToEquity != null && f.debtToEquity < 1.0) qualityScore += 1;

        if (f.currentRatio && f.currentRatio > 1.5) qualityScore += 1;
      }

      return {
        ticker: c.ticker,
        name: c.name,
        sector: c.sector,
        currentPrice: v.currentPrice,
        compositeValue: v.compositeValue,
        upsidePercent: v.upsidePercent,
        qualityScore,
      };
    });

  // Sort by composite score (upside * quality)
  scored.sort((a, b) => {
    const scoreA = a.upsidePercent * (1 + a.qualityScore * 0.1);
    const scoreB = b.upsidePercent * (1 + b.qualityScore * 0.1);
    return scoreB - scoreA;
  });

  // Select positions with sector diversification
  const selected: ScoredCompany[] = [];
  const sectorCount: Record<string, number> = {};

  for (const company of scored) {
    if (selected.length >= MAX_POSITIONS) break;

    const currentSectorCount = sectorCount[company.sector] || 0;
    const maxPerSector = Math.ceil(MAX_POSITIONS * MAX_SECTOR_WEIGHT / 100 * 100);

    if (currentSectorCount < maxPerSector || selected.length < MIN_POSITIONS) {
      selected.push(company);
      sectorCount[company.sector] = currentSectorCount + 1;
    }
  }

  if (selected.length === 0) {
    return {
      positions: [],
      totalExpectedReturn: 0,
      sectorBreakdown: {},
      aiSummary: 'No undervalued companies found in the database. Please analyze more companies first.',
    };
  }

  // Calculate weights (proportional to upside * quality, with sector caps)
  const totalScore = selected.reduce((sum, c) => sum + c.upsidePercent * (1 + c.qualityScore * 0.1), 0);

  let positions: PortfolioPosition[] = selected.map((c) => {
    const rawWeight = (c.upsidePercent * (1 + c.qualityScore * 0.1)) / totalScore * 100;
    return {
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      weight: rawWeight,
      currentPrice: c.currentPrice,
      fairValue: c.compositeValue,
      upsidePercent: c.upsidePercent,
      rating: 'undervalued',
      rationale: generateRationale(c),
    };
  });

  // Apply sector weight caps and normalize
  positions = applySectorCaps(positions);

  // Sector breakdown
  const sectorBreakdown: Record<string, number> = {};
  for (const p of positions) {
    sectorBreakdown[p.sector] = (sectorBreakdown[p.sector] || 0) + p.weight;
  }

  const totalExpectedReturn = positions.reduce((sum, p) => sum + p.upsidePercent * p.weight / 100, 0);

  return {
    positions,
    totalExpectedReturn,
    sectorBreakdown,
  };
}

function applySectorCaps(positions: PortfolioPosition[]): PortfolioPosition[] {
  const maxWeight = MAX_SECTOR_WEIGHT * 100;
  let needsRebalance = true;

  while (needsRebalance) {
    needsRebalance = false;
    const sectorWeights: Record<string, number> = {};

    for (const p of positions) {
      sectorWeights[p.sector] = (sectorWeights[p.sector] || 0) + p.weight;
    }

    for (const [sector, totalWeight] of Object.entries(sectorWeights)) {
      if (totalWeight > maxWeight) {
        const scale = maxWeight / totalWeight;
        const excess = totalWeight - maxWeight;
        const otherPositions = positions.filter((p) => p.sector !== sector);
        const otherTotal = otherPositions.reduce((s, p) => s + p.weight, 0);

        for (const p of positions) {
          if (p.sector === sector) {
            p.weight *= scale;
          } else if (otherTotal > 0) {
            p.weight += (excess * p.weight) / otherTotal;
          }
        }
        needsRebalance = true;
        break;
      }
    }
  }

  // Normalize to 100%
  const total = positions.reduce((s, p) => s + p.weight, 0);
  if (total > 0) {
    for (const p of positions) {
      p.weight = (p.weight / total) * 100;
    }
  }

  return positions;
}

function generateRationale(c: ScoredCompany): string {
  const parts: string[] = [];
  parts.push(`${c.upsidePercent.toFixed(1)}% upside to fair value of $${c.compositeValue.toFixed(2)}`);
  if (c.qualityScore >= 7) parts.push('High financial quality');
  else if (c.qualityScore >= 4) parts.push('Good financial quality');
  return parts.join('. ') + '.';
}
