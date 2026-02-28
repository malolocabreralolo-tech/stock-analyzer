import prisma from './db';
import { getSP500FromWikipedia } from './data-sources/sp500-wiki';

let seedInProgress = false;

export async function seedMockData() {
  const existingCount = await prisma.company.count();
  if (existingCount >= 100) return; // Already seeded with S&P 500

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
          },
        });
        count++;
      } catch (err) {
        console.warn(`Failed to upsert ${company.symbol}:`, err);
      }
    }

    console.log(`Seeded ${count} S&P 500 companies from Wikipedia.`);
  } catch (err) {
    console.error('Failed to seed S&P 500 from Wikipedia:', err);
    // Don't throw — the app can still work without seeding
  } finally {
    seedInProgress = false;
  }
}
