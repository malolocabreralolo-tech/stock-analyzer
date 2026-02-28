import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/db';
import { ComparableCompany } from '@/types';
import ComparablesTable from '@/components/comparables/ComparablesTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ sector: string }>;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default async function SectorComparablesPage({ params }: PageProps) {
  const { sector: rawSector } = await params;
  const sector = decodeURIComponent(rawSector);

  const companies = await prisma.company.findMany({
    where: { sector },
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

  if (companies.length === 0) notFound();

  const comparables: ComparableCompany[] = companies
    .filter((c) => c.valuations[0])
    .map((c) => {
      const v = c.valuations[0];
      const f = c.financials[0];
      return {
        ticker: c.ticker,
        name: c.name,
        marketCap: c.marketCap || 0,
        price: v.currentPrice,
        fairValue: v.compositeValue,
        upsidePercent: v.upsidePercent,
        rating: v.rating,
        pe: f?.pe ?? null,
        evEbitda: f?.evEbitda ?? null,
        pb: f?.pb ?? null,
        ps: f?.ps ?? null,
        roe: f?.roe ?? null,
        grossMargin: f?.grossMargin ?? null,
        operatingMargin: f?.operatingMargin ?? null,
        netMargin: f?.netMargin ?? null,
        debtToEquity: f?.debtToEquity ?? null,
        revenueGrowth: f?.revenueGrowth ?? null,
      };
    });

  // Compute sector medians for the table
  const peVals = comparables.filter((c) => c.pe != null && c.pe > 0 && c.pe < 100).map((c) => c.pe!);
  const evVals = comparables.filter((c) => c.evEbitda != null && c.evEbitda > 0 && c.evEbitda < 100).map((c) => c.evEbitda!);
  const pbVals = comparables.filter((c) => c.pb != null && c.pb > 0).map((c) => c.pb!);
  const roeVals = comparables.filter((c) => c.roe != null).map((c) => c.roe!);
  const gmVals = comparables.filter((c) => c.grossMargin != null).map((c) => c.grossMargin!);
  const omVals = comparables.filter((c) => c.operatingMargin != null).map((c) => c.operatingMargin!);
  const deVals = comparables.filter((c) => c.debtToEquity != null && c.debtToEquity >= 0).map((c) => c.debtToEquity!);

  const sectorMedians = {
    pe: median(peVals),
    evEbitda: median(evVals),
    pb: median(pbVals),
    roe: median(roeVals),
    grossMargin: median(gmVals),
    operatingMargin: median(omVals),
    debtToEquity: median(deVals),
  };

  const avgUpside = comparables.length > 0
    ? comparables.reduce((s, c) => s + c.upsidePercent, 0) / comparables.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/comparables"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Sectors
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{sector}</h1>
          <p className="text-muted-foreground mt-1">
            {comparables.length} companies with valuations
          </p>
        </div>
        <Badge
          variant={avgUpside >= 0 ? 'default' : 'destructive'}
          className="text-sm px-3 py-1"
        >
          Avg Upside: {avgUpside >= 0 ? '+' : ''}{avgUpside.toFixed(1)}%
        </Badge>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Median P/E', value: sectorMedians.pe?.toFixed(1) ?? 'N/A' },
          { label: 'Median EV/EBITDA', value: sectorMedians.evEbitda?.toFixed(1) ?? 'N/A' },
          { label: 'Median ROE', value: sectorMedians.roe != null ? `${(sectorMedians.roe * 100).toFixed(1)}%` : 'N/A' },
          { label: 'Median D/E', value: sectorMedians.debtToEquity?.toFixed(1) ?? 'N/A' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold tabular-nums mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Comparable Companies</CardTitle>
        </CardHeader>
        <CardContent>
          <ComparablesTable companies={comparables} sectorMedians={sectorMedians} />
        </CardContent>
      </Card>
    </div>
  );
}
