'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.slice(0, 8));
      setIsOpen(true);
    } catch {
      setResults([]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    const timeout = setTimeout(() => search(value), 300);
    return () => clearTimeout(timeout);
  };

  const selectCompany = (symbol: string) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    router.push(`/company/${symbol}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      selectCompany(query.trim().toUpperCase());
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <Input
        placeholder="Search ticker or company... (e.g. AAPL)"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="w-full"
      />
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
          {results.map((r) => (
            <button
              key={r.symbol}
              className="w-full text-left px-4 py-3 hover:bg-accent flex items-center justify-between transition-colors"
              onMouseDown={() => selectCompany(r.symbol)}
            >
              <div>
                <span className="font-semibold text-sm">{r.symbol}</span>
                <span className="text-muted-foreground text-sm ml-2">{r.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
