import Anthropic from '@anthropic-ai/sdk';
import { CompanyProfile, FinancialData, ValuationResult, AIAnalysis } from '@/types';

function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here';
}

function getClient(): Anthropic | null {
  if (!hasApiKey()) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function generateLocalAnalysis(
  profile: CompanyProfile,
  financials: FinancialData[],
  valuation: ValuationResult,
): AIAnalysis {
  const latest = financials[0];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const catalysts: string[] = [];
  const risks: string[] = [];

  // Analyze margins
  if (latest?.grossMargin && latest.grossMargin > 0.5) strengths.push(`Strong gross margins of ${(latest.grossMargin * 100).toFixed(1)}%, indicating pricing power and competitive moat`);
  else if (latest?.grossMargin && latest.grossMargin < 0.3) weaknesses.push(`Low gross margins of ${(latest.grossMargin * 100).toFixed(1)}%, suggesting limited pricing power`);

  if (latest?.operatingMargin && latest.operatingMargin > 0.2) strengths.push(`Healthy operating margins of ${(latest.operatingMargin * 100).toFixed(1)}%, demonstrating operational efficiency`);
  else if (latest?.operatingMargin && latest.operatingMargin < 0.1) weaknesses.push(`Thin operating margins of ${(latest.operatingMargin * 100).toFixed(1)}%, leaving little room for error`);

  // Analyze ROE
  if (latest?.roe && latest.roe > 0.2) strengths.push(`Excellent return on equity of ${(latest.roe * 100).toFixed(1)}%, indicating efficient use of shareholder capital`);
  else if (latest?.roe && latest.roe < 0.1 && latest.roe > 0) weaknesses.push(`Below-average ROE of ${(latest.roe * 100).toFixed(1)}%`);

  // Analyze debt
  if (latest?.debtToEquity != null && latest.debtToEquity < 0.5) strengths.push(`Conservative balance sheet with debt-to-equity of ${latest.debtToEquity.toFixed(2)}`);
  else if (latest?.debtToEquity != null && latest.debtToEquity > 2) weaknesses.push(`High leverage with debt-to-equity of ${latest.debtToEquity.toFixed(2)}`);

  // Analyze growth
  if (latest?.revenueGrowth && latest.revenueGrowth > 0.1) catalysts.push(`Strong revenue growth of ${(latest.revenueGrowth * 100).toFixed(1)}% year-over-year`);
  else if (latest?.revenueGrowth && latest.revenueGrowth < 0) risks.push(`Revenue decline of ${(latest.revenueGrowth * 100).toFixed(1)}% could signal demand challenges`);

  if (latest?.epsGrowth && latest.epsGrowth > 0.15) catalysts.push(`Earnings momentum with EPS growth of ${(latest.epsGrowth * 100).toFixed(1)}%`);

  // Free cash flow
  if (latest?.freeCashFlow && latest.freeCashFlow > 0) strengths.push(`Positive free cash flow of $${(latest.freeCashFlow / 1e9).toFixed(1)}B supports dividends and buybacks`);
  else if (latest?.freeCashFlow && latest.freeCashFlow < 0) weaknesses.push('Negative free cash flow requires external financing');

  // Valuation
  if (valuation.rating === 'undervalued') catalysts.push(`Trading at ${valuation.upsidePercent.toFixed(1)}% discount to estimated fair value of $${valuation.compositeValue.toFixed(2)}`);
  if (valuation.rating === 'overvalued') risks.push(`Trading at a ${Math.abs(valuation.upsidePercent).toFixed(1)}% premium to estimated fair value`);

  // Generic risks
  risks.push('Macroeconomic uncertainty and potential recession risk');
  risks.push(`Sector-specific risks in ${profile.sector}`);

  // Ensure minimums
  while (strengths.length < 2) strengths.push(`Established ${profile.sector} company with market presence`);
  while (weaknesses.length < 2) weaknesses.push('Subject to regulatory and competitive pressures');
  while (catalysts.length < 2) catalysts.push('Potential for multiple expansion if earnings improve');

  // Ratio interpretation
  const ratioLines: string[] = [];
  if (latest?.pe) ratioLines.push(`The P/E ratio of ${latest.pe.toFixed(1)}x is ${latest.pe > 25 ? 'above' : latest.pe < 15 ? 'below' : 'near'} the market average`);
  if (latest?.roe) ratioLines.push(`ROE of ${(latest.roe * 100).toFixed(1)}% ${latest.roe > 0.15 ? 'exceeds' : 'falls below'} the typical benchmark of 15%`);
  if (latest?.netMargin) ratioLines.push(`Net margin of ${(latest.netMargin * 100).toFixed(1)}% reflects the company's profitability profile`);
  if (financials.length >= 2) {
    const marginTrend = (latest?.operatingMargin || 0) - (financials[1]?.operatingMargin || 0);
    ratioLines.push(`Operating margins have ${marginTrend > 0 ? 'expanded' : 'contracted'} over the past year, ${marginTrend > 0 ? 'a positive signal' : 'which bears monitoring'}`);
  }

  return {
    executiveSummary: `${profile.name} (${profile.ticker}) is a ${profile.sector} company with a market cap of $${((profile.marketCap || 0) / 1e9).toFixed(0)}B. Our composite valuation model rates it as ${valuation.rating} with a fair value estimate of $${valuation.compositeValue.toFixed(2)}, representing ${valuation.upsidePercent > 0 ? 'an' : 'a'} ${valuation.upsidePercent.toFixed(1)}% ${valuation.upsidePercent > 0 ? 'upside' : 'downside'} from current levels.`,
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 3),
    catalysts: catalysts.slice(0, 3),
    risks: risks.slice(0, 3),
    ratioInterpretation: ratioLines.join('. ') + '.',
    outlook: `Based on current financials and valuation, ${profile.name} is rated ${valuation.rating}. ${valuation.rating === 'undervalued' ? 'The stock offers potential upside for patient investors willing to hold through near-term volatility.' : valuation.rating === 'overvalued' ? 'Investors may want to wait for a more attractive entry point.' : 'The stock appears fairly priced at current levels.'}`,
  };
}

export async function generateAnalysis(
  profile: CompanyProfile,
  financials: FinancialData[],
  valuation: ValuationResult,
): Promise<AIAnalysis> {
  const client = getClient();

  // Use local analysis if no API key
  if (!client) {
    return generateLocalAnalysis(profile, financials, valuation);
  }

  const financialSummary = financials.slice(0, 5).map((f) => ({
    period: f.period,
    revenue: f.revenue ? `$${(f.revenue / 1e9).toFixed(2)}B` : 'N/A',
    netIncome: f.netIncome ? `$${(f.netIncome / 1e9).toFixed(2)}B` : 'N/A',
    fcf: f.freeCashFlow ? `$${(f.freeCashFlow / 1e9).toFixed(2)}B` : 'N/A',
    margins: {
      gross: f.grossMargin ? `${(f.grossMargin * 100).toFixed(1)}%` : 'N/A',
      operating: f.operatingMargin ? `${(f.operatingMargin * 100).toFixed(1)}%` : 'N/A',
      net: f.netMargin ? `${(f.netMargin * 100).toFixed(1)}%` : 'N/A',
    },
    ratios: {
      pe: f.pe?.toFixed(1) || 'N/A',
      roe: f.roe ? `${(f.roe * 100).toFixed(1)}%` : 'N/A',
      debtToEquity: f.debtToEquity?.toFixed(2) || 'N/A',
      currentRatio: f.currentRatio?.toFixed(2) || 'N/A',
    },
    growth: {
      revenue: f.revenueGrowth ? `${(f.revenueGrowth * 100).toFixed(1)}%` : 'N/A',
      eps: f.epsGrowth ? `${(f.epsGrowth * 100).toFixed(1)}%` : 'N/A',
    },
  }));

  const prompt = `You are a senior equity research analyst. Analyze the following company and provide a structured analysis.

Company: ${profile.name} (${profile.ticker})
Sector: ${profile.sector} | Industry: ${profile.industry}
Market Cap: $${((profile.marketCap || 0) / 1e9).toFixed(2)}B
Current Price: $${profile.price?.toFixed(2)}

Financial Data (Last ${financialSummary.length} years):
${JSON.stringify(financialSummary, null, 2)}

Valuation:
- DCF Fair Value: ${valuation.dcfValue ? `$${valuation.dcfValue.toFixed(2)}` : 'N/A'}
- Multiples Fair Value: ${valuation.multiplesValue ? `$${valuation.multiplesValue.toFixed(2)}` : 'N/A'}
- Composite Fair Value: $${valuation.compositeValue.toFixed(2)}
- Upside/Downside: ${valuation.upsidePercent.toFixed(1)}%
- Rating: ${valuation.rating}

Provide your analysis in EXACTLY this JSON format (no markdown, just raw JSON):
{
  "executiveSummary": "2-3 sentence overview of the company's financial health and investment thesis",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "catalysts": ["catalyst 1", "catalyst 2"],
  "risks": ["risk 1", "risk 2", "risk 3"],
  "ratioInterpretation": "1-2 paragraphs interpreting the key financial ratios and trends",
  "outlook": "1-2 sentence 2-year outlook"
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const parsed = JSON.parse(content.text) as AIAnalysis;
    return parsed;
  } catch (error) {
    console.error('AI analysis error:', error);
    return generateLocalAnalysis(profile, financials, valuation);
  }
}

export async function generatePortfolioSummary(
  positions: Array<{ ticker: string; name: string; weight: number; sector: string; upside: number; rationale: string }>,
): Promise<string> {
  const client = getClient();

  if (!client) {
    const sectors = [...new Set(positions.map((p) => p.sector))];
    const avgUpside = positions.reduce((s, p) => s + p.upside, 0) / positions.length;
    const topHoldings = positions.sort((a, b) => b.weight - a.weight).slice(0, 3);

    return `This portfolio consists of ${positions.length} positions diversified across ${sectors.length} sectors (${sectors.join(', ')}). The average upside potential is ${avgUpside.toFixed(1)}%, based on our composite valuation models combining DCF and multiples analysis.\n\nThe top holdings are ${topHoldings.map((p) => `${p.ticker} (${p.weight.toFixed(1)}%)`).join(', ')}, selected for their combination of valuation discount and financial quality. The portfolio emphasizes companies with strong fundamentals trading below their estimated intrinsic value.\n\nKey risks include sector concentration, model estimation error in fair value calculations, and macroeconomic factors that could affect all positions simultaneously. The portfolio is designed for a 1-2 year holding period.`;
  }

  const prompt = `You are a portfolio strategist. Summarize this suggested portfolio in 2-3 paragraphs:

Portfolio Positions:
${positions.map((p) => `- ${p.ticker} (${p.name}): ${p.weight.toFixed(1)}% weight, ${p.sector}, ${p.upside.toFixed(1)}% upside potential`).join('\n')}

Total positions: ${positions.length}
Sectors represented: ${[...new Set(positions.map((p) => p.sector))].join(', ')}

Explain the portfolio's thesis, diversification strategy, and key risks. Be concise.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') return 'Portfolio summary unavailable.';
    return content.text;
  } catch {
    return 'AI portfolio summary is temporarily unavailable. The portfolio has been optimized based on valuation upside, sector diversification, and financial quality metrics.';
  }
}
