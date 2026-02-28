'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative flex-1 max-w-lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          placeholder="Search ticker or company..."
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="w-full h-9 pl-9 pr-16 rounded-lg border border-border bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-colors"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-lg shadow-xl z-50 max-h-80 overflow-auto">
          {results.map((r) => (
            <button
              key={r.symbol}
              className="w-full text-left px-4 py-2.5 hover:bg-accent flex items-center justify-between transition-colors first:rounded-t-lg last:rounded-b-lg"
              onMouseDown={() => selectCompany(r.symbol)}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm text-primary">{r.symbol}</span>
                <span className="text-muted-foreground text-sm truncate">{r.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
