import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateOptimalPortfolio } from '@/lib/portfolio/optimizer';
import { generatePortfolioSummary } from '@/lib/ai/analyst';

export async function GET() {
  const portfolio = await generateOptimalPortfolio();

  if (portfolio.positions.length > 0) {
    // Generate AI summary
    try {
      portfolio.aiSummary = await generatePortfolioSummary(
        portfolio.positions.map((p) => ({
          ticker: p.ticker,
          name: p.name,
          weight: p.weight,
          sector: p.sector,
          upside: p.upsidePercent,
          rationale: p.rationale,
        })),
      );
    } catch {
      // AI summary is optional
    }

    // Save portfolio to DB
    await prisma.portfolio.create({
      data: {
        name: `Optimal Portfolio ${new Date().toISOString().split('T')[0]}`,
        aiSummary: portfolio.aiSummary,
        positions: {
          create: portfolio.positions.map((p) => ({
            ticker: p.ticker,
            weight: p.weight,
            rationale: p.rationale,
          })),
        },
      },
    });
  }

  return NextResponse.json(portfolio);
}
