'use client';

import { useState } from 'react';
import Link from 'next/link';

interface CompanyEntry {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  fairValue: number | null;
  upsidePercent: number | null;
  rating: string | null;
  hasValuation: boolean;
}

interface DashboardFiltersProps {
  sectorMap: Record<string, CompanyEntry[]>;
  sectors: string[];
}

const RATING_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'undervalued', label: 'Undervalued' },
  { key: 'fair', label: 'Fair' },
  { key: 'overvalued', label: 'Overvalued' },
];

export default function DashboardFilters({ sectorMap, sectors }: DashboardFiltersProps) {
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');

  const filteredSectors = selectedSector === 'all' ? sectors : [selectedSector];

  return (
    <section>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <h2 className="text-base font-semibold">All Companies</h2>
        <div className="flex flex-wrap gap-2">
          {/* Sector filter */}
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="h-8 px-2 rounded-lg border border-border bg-muted/50 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Rating filter */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {RATING_FILTERS.map((rf) => (
              <button
                key={rf.key}
                onClick={() => setSelectedRating(rf.key)}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors border-r border-border last:border-r-0 ${
                  selectedRating === rf.key
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {filteredSectors.map((sector) => {
          const companies = sectorMap[sector] || [];
          const filtered = selectedRating === 'all'
            ? companies
            : companies.filter((c) => c.rating === selectedRating);
          if (filtered.length === 0) return null;

          return (
            <div key={sector}>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground border-b border-border pb-1">
                {sector}{' '}
                <span className="text-xs font-normal">({filtered.length})</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {filtered.map((c) => (
                  <Link
                    key={c.ticker}
                    href={`/company/${c.ticker}`}
                    className="block rounded-lg border border-border p-2.5 hover:bg-accent/50 hover:border-primary/30 transition-colors"
                  >
                    <p className="font-mono text-sm font-bold">{c.ticker}</p>
                    <p className="text-[11px] text-muted-foreground truncate" title={c.name}>
                      {c.name}
                    </p>
                    {c.hasValuation && c.upsidePercent !== null && (
                      <p
                        className={`text-xs font-semibold mt-1 tabular-nums ${
                          c.rating === 'undervalued'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : c.rating === 'overvalued'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {c.upsidePercent >= 0 ? '+' : ''}
                        {c.upsidePercent.toFixed(1)}%
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
