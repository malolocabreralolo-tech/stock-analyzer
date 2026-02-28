'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LayoutDashboard, PieChart, Briefcase, ChevronLeft, ChevronRight, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sectors', label: 'Sectors', icon: PieChart },
  { href: '/comparables', label: 'Comparables', icon: BarChart3 },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
];

interface RecentItem {
  ticker: string;
  name: string;
  timestamp: number;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recently-viewed');
      if (stored) setRecentlyViewed(JSON.parse(stored).slice(0, 5));
    } catch {}
  }, []);

  // Track company page visits
  useEffect(() => {
    const match = pathname.match(/^\/company\/([A-Z0-9.]+)$/i);
    if (match) {
      const ticker = match[1].toUpperCase();
      try {
        const stored = localStorage.getItem('recently-viewed');
        const items: RecentItem[] = stored ? JSON.parse(stored) : [];
        const filtered = items.filter((i) => i.ticker !== ticker);
        filtered.unshift({ ticker, name: ticker, timestamp: Date.now() });
        const trimmed = filtered.slice(0, 8);
        localStorage.setItem('recently-viewed', JSON.stringify(trimmed));
        setRecentlyViewed(trimmed.slice(0, 5));
      } catch {}
    }
  }, [pathname]);

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-screen sticky top-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between min-h-[60px]">
        {!collapsed && (
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-sidebar-primary" />
              <h1 className="text-base font-bold tracking-tight">StockAnalyzer</h1>
            </div>
            <p className="text-[10px] text-sidebar-foreground/50 mt-0.5 ml-7">Financial Analysis</p>
          </div>
        )}
        {collapsed && <TrendingUp className="w-5 h-5 text-sidebar-primary mx-auto" />}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              pathname === item.href
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && item.label}
          </Link>
        ))}

        {/* Recently Viewed */}
        {!collapsed && recentlyViewed.length > 0 && (
          <div className="mt-6 pt-4 border-t border-sidebar-border">
            <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-2 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Recently Viewed
            </p>
            {recentlyViewed.map((item) => (
              <Link
                key={item.ticker}
                href={`/company/${item.ticker}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <span className="font-mono font-semibold">{item.ticker}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}
