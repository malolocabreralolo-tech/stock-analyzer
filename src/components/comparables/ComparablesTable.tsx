'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ComparableCompany } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown } from 'lucide-react';

interface ComparablesTableProps {
  companies: ComparableCompany[];
  sectorMedians: {
    pe: number | null;
    evEbitda: number | null;
    pb: number | null;
    roe: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    debtToEquity: number | null;
  };
}

type SortKey = keyof ComparableCompany;

function formatMarketCap(mc: number) {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toFixed(0)}`;
}

function colorCell(value: number | null, median: number | null, lowerIsBetter = false) {
  if (value == null || median == null) return '';
  const diff = lowerIsBetter ? median - value : value - median;
  if (diff > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (diff < 0) return 'text-red-600 dark:text-red-400';
  return '';
}

export default function ComparablesTable({ companies, sectorMedians }: ComparablesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('upsidePercent');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...companies].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead
      className="cursor-pointer select-none text-right whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className="w-3 h-3 opacity-50" />
      </span>
    </TableHead>
  );

  const fmtNum = (v: number | null, decimals = 1) => (v != null ? v.toFixed(decimals) : '—');
  const fmtPct = (v: number | null) => (v != null ? `${(v * 100).toFixed(1)}%` : '—');

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer" onClick={() => handleSort('ticker')}>
              Ticker <ArrowUpDown className="w-3 h-3 inline opacity-50" />
            </TableHead>
            <TableHead>Name</TableHead>
            <SortHeader label="Mkt Cap" field="marketCap" />
            <SortHeader label="Price" field="price" />
            <SortHeader label="Fair Value" field="fairValue" />
            <SortHeader label="Upside%" field="upsidePercent" />
            <SortHeader label="P/E" field="pe" />
            <SortHeader label="EV/EBITDA" field="evEbitda" />
            <SortHeader label="P/B" field="pb" />
            <SortHeader label="ROE" field="roe" />
            <SortHeader label="Gross Mgn" field="grossMargin" />
            <SortHeader label="Op Mgn" field="operatingMargin" />
            <SortHeader label="D/E" field="debtToEquity" />
            <TableHead>Rating</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((c) => (
            <TableRow key={c.ticker} className="hover:bg-muted/50">
              <TableCell>
                <Link href={`/company/${c.ticker}`} className="font-bold font-mono hover:underline">
                  {c.ticker}
                </Link>
              </TableCell>
              <TableCell className="text-sm max-w-[180px] truncate">{c.name}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMarketCap(c.marketCap)}</TableCell>
              <TableCell className="text-right tabular-nums">${c.price.toFixed(2)}</TableCell>
              <TableCell className="text-right tabular-nums">${c.fairValue.toFixed(2)}</TableCell>
              <TableCell className="text-right">
                <span className={`font-bold ${c.upsidePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {c.upsidePercent >= 0 ? '+' : ''}{c.upsidePercent.toFixed(1)}%
                </span>
              </TableCell>
              <TableCell className={`text-right tabular-nums ${colorCell(c.pe, sectorMedians.pe, true)}`}>
                {fmtNum(c.pe)}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${colorCell(c.evEbitda, sectorMedians.evEbitda, true)}`}>
                {fmtNum(c.evEbitda)}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${colorCell(c.pb, sectorMedians.pb, true)}`}>
                {fmtNum(c.pb)}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${colorCell(c.roe, sectorMedians.roe)}`}>
                {fmtPct(c.roe)}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${colorCell(c.grossMargin, sectorMedians.grossMargin)}`}>
                {fmtPct(c.grossMargin)}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${colorCell(c.operatingMargin, sectorMedians.operatingMargin)}`}>
                {fmtPct(c.operatingMargin)}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${colorCell(c.debtToEquity, sectorMedians.debtToEquity, true)}`}>
                {fmtNum(c.debtToEquity)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={c.rating === 'undervalued' ? 'default' : c.rating === 'overvalued' ? 'destructive' : 'secondary'}
                  className="text-xs capitalize"
                >
                  {c.rating}
                </Badge>
              </TableCell>
            </TableRow>
          ))}

          {/* Sector Median Row */}
          <TableRow className="bg-muted/30 font-semibold border-t-2">
            <TableCell colSpan={2} className="text-xs uppercase tracking-wider text-muted-foreground">
              Sector Median
            </TableCell>
            <TableCell colSpan={4} />
            <TableCell className="text-right tabular-nums">{fmtNum(sectorMedians.pe)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtNum(sectorMedians.evEbitda)}</TableCell>
            <TableCell className="text-right tabular-nums">—</TableCell>
            <TableCell className="text-right tabular-nums">{sectorMedians.roe != null ? fmtPct(sectorMedians.roe) : '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{sectorMedians.grossMargin != null ? fmtPct(sectorMedians.grossMargin) : '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{sectorMedians.operatingMargin != null ? fmtPct(sectorMedians.operatingMargin) : '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtNum(sectorMedians.debtToEquity)}</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
