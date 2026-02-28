'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PortfolioTable from '@/components/portfolio/PortfolioTable';
import AllocationChart from '@/components/portfolio/AllocationChart';
import { PortfolioSuggestion } from '@/types';

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portfolio');
      if (!res.ok) throw new Error('Failed to generate portfolio');
      const data = await res.json();
      setPortfolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate portfolio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Optimal Portfolio</h1>
          <p className="text-muted-foreground mt-1">
            AI-optimized portfolio based on valuation, diversification, and quality
          </p>
        </div>
        <Button onClick={generatePortfolio} disabled={loading} size="lg">
          {loading ? 'Generating...' : portfolio ? 'Regenerate' : 'Generate Portfolio'}
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="p-6 text-center text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      )}

      {!loading && !portfolio && (
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Generate Your Optimal Portfolio</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-4">
              The optimizer will analyze all companies in your database and select 10-20
              undervalued positions with optimal diversification and quality scores.
            </p>
            <p className="text-sm text-muted-foreground">
              Make sure you have analyzed multiple companies first by visiting their individual pages.
            </p>
          </CardContent>
        </Card>
      )}

      {portfolio && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Positions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{portfolio.positions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expected Return</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">
                  +{portfolio.totalExpectedReturn.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sectors</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {Object.keys(portfolio.sectorBreakdown).length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Allocation chart */}
          {Object.keys(portfolio.sectorBreakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <AllocationChart sectorBreakdown={portfolio.sectorBreakdown} />
              </CardContent>
            </Card>
          )}

          {/* Positions table */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <PortfolioTable positions={portfolio.positions} />
            </CardContent>
          </Card>

          {/* AI Summary */}
          {portfolio.aiSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Portfolio Analysis
                  <span className="text-xs font-normal text-muted-foreground">by Claude Sonnet 4.6</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {portfolio.aiSummary}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
