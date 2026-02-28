import prisma from './db';
import { getSP500FromWikipedia } from './data-sources/sp500-wiki';
import { getAllGlobalWikiCompanies } from './data-sources/global-wiki';
import globalCompaniesJson from './data-sources/global-companies.json';

let seedInProgress = false;

export async function seedMockData() {
  // Always re-seed to ensure sector/industry names stay consistent with Wikipedia GICS

  // Prevent concurrent seed calls
  if (seedInProgress) return;
  seedInProgress = true;

  console.log('Seeding S&P 500 company list from Wikipedia...');

  try {
    const sp500 = await getSP500FromWikipedia();

    // Batch upsert all companies with just profile info.
    // Financial data and valuations are fetched on-demand when a user visits /company/[ticker].
    let count = 0;
    for (const company of sp500) {
      try {
        await prisma.company.upsert({
          where: { ticker: company.symbol },
          update: {
            name: company.name,
            sector: company.sector,
            industry: company.subIndustry,
          },
          create: {
            ticker: company.symbol,
            name: company.name,
            sector: company.sector,
            industry: company.subIndustry,
            exchange: 'NYSE/NASDAQ', // placeholder; updated on first visit
            country: 'US',
          },
        });
        count++;
      } catch (err) {
        console.warn(`Failed to upsert ${company.symbol}:`, err);
      }
    }

    console.log(`Seeded ${count} S&P 500 companies from Wikipedia.`);

    // --- Global companies ---
    console.log('Seeding global companies...');

    // Build a set of already-seeded S&P 500 tickers to avoid logging duplicates
    const sp500Tickers = new Set(sp500.map((c) => c.symbol));

    // Gather global wiki companies (European indices)
    let globalWikiCompanies: Array<{ symbol: string; name: string; sector: string; subIndustry: string; country: string }> = [];
    try {
      globalWikiCompanies = await getAllGlobalWikiCompanies();
    } catch (err) {
      console.warn('Failed to fetch global wiki companies:', err);
    }

    // Combine wiki companies + static JSON, deduplicate by symbol (prefer wiki data if available)
    const seen = new Set<string>(sp500Tickers);
    const allGlobal: Array<{ symbol: string; name: string; sector: string; subIndustry: string; country: string }> = [];

    for (const company of globalWikiCompanies) {
      if (!seen.has(company.symbol)) {
        seen.add(company.symbol);
        allGlobal.push(company);
      }
    }

    for (const company of globalCompaniesJson as Array<{ symbol: string; name: string; sector: string; subIndustry: string; country: string }>) {
      if (!seen.has(company.symbol)) {
        seen.add(company.symbol);
        allGlobal.push(company);
      }
    }

    let globalCount = 0;
    for (const company of allGlobal) {
      try {
        await prisma.company.upsert({
          where: { ticker: company.symbol },
          update: {
            name: company.name,
            sector: company.sector,
            industry: company.subIndustry,
            country: company.country,
          },
          create: {
            ticker: company.symbol,
            name: company.name,
            sector: company.sector,
            industry: company.subIndustry,
            exchange: 'TBD', // updated on first visit
            country: company.country,
          },
        });
        globalCount++;
      } catch (err) {
        console.warn(`Failed to upsert global ${company.symbol}:`, err);
      }
    }

    console.log(`Seeded ${globalCount} global companies.`);
    console.log(`Total seeded: ${count + globalCount} companies.`);
  } catch (err) {
    console.error('Failed to seed companies:', err);
    // Don't throw — the app can still work without seeding
  } finally {
    seedInProgress = false;
  }
}
