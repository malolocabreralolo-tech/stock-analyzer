import prisma from '@/lib/db';

export interface DynamicSectorMedians {
  pe: number | null;
  evEbitda: number | null;
  pb: number | null;
  ps: number | null;
  sampleSize: number;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

const MIN_SAMPLE = 3;

export async function getSectorMultiplesFromDB(
  sector: string,
  excludeTicker?: string,
): Promise<DynamicSectorMedians | null> {
  const companies = await prisma.company.findMany({
    where: {
      sector,
      ...(excludeTicker ? { ticker: { not: excludeTicker } } : {}),
    },
    select: {
      financials: {
        orderBy: { period: 'desc' },
        take: 1,
        select: { pe: true, evEbitda: true, pb: true, ps: true },
      },
    },
  });

  const peValues: number[] = [];
  const evEbitdaValues: number[] = [];
  const pbValues: number[] = [];
  const psValues: number[] = [];

  for (const c of companies) {
    const f = c.financials[0];
    if (!f) continue;
    if (f.pe != null && f.pe > 0 && f.pe < 100) peValues.push(f.pe);
    if (f.evEbitda != null && f.evEbitda > 0 && f.evEbitda < 100) evEbitdaValues.push(f.evEbitda);
    if (f.pb != null && f.pb > 0 && f.pb < 50) pbValues.push(f.pb);
    if (f.ps != null && f.ps > 0 && f.ps < 50) psValues.push(f.ps);
  }

  const sampleSize = companies.length;
  if (sampleSize === 0) return null;

  return {
    pe: peValues.length >= MIN_SAMPLE ? median(peValues) : null,
    evEbitda: evEbitdaValues.length >= MIN_SAMPLE ? median(evEbitdaValues) : null,
    pb: pbValues.length >= MIN_SAMPLE ? median(pbValues) : null,
    ps: psValues.length >= MIN_SAMPLE ? median(psValues) : null,
    sampleSize,
  };
}
