'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AIAnalysis as AIAnalysisType } from '@/types';

interface AIAnalysisProps {
  ticker: string;
}

export default function AIAnalysisComponent({ ticker }: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState<AIAnalysisType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/analyze?ticker=${ticker}`);
      if (!res.ok) throw new Error('Failed to generate analysis');
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setLoading(false);
    }
  };

  if (!analysis && !loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">
            Generate an AI-powered analysis of this company using Claude Sonnet 4.6
          </p>
          <Button onClick={fetchAnalysis}>Generate AI Analysis</Button>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
          <p className="text-sm text-muted-foreground">Analyzing with Claude Sonnet 4.6...</p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI Analysis
          <span className="text-xs font-normal text-muted-foreground">by Claude Sonnet 4.6</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Executive Summary */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Executive Summary</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.executiveSummary}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div>
            <h4 className="font-semibold text-sm mb-2 text-green-600">Strengths</h4>
            <ul className="space-y-1">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-green-600 shrink-0">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div>
            <h4 className="font-semibold text-sm mb-2 text-red-600">Weaknesses</h4>
            <ul className="space-y-1">
              {analysis.weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-red-600 shrink-0">-</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>

          {/* Catalysts */}
          <div>
            <h4 className="font-semibold text-sm mb-2 text-blue-600">Catalysts</h4>
            <ul className="space-y-1">
              {analysis.catalysts.map((c, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-blue-600 shrink-0">*</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* Risks */}
          <div>
            <h4 className="font-semibold text-sm mb-2 text-orange-600">Risks</h4>
            <ul className="space-y-1">
              {analysis.risks.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-orange-600 shrink-0">!</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Ratio Interpretation */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Ratio Analysis</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.ratioInterpretation}</p>
        </div>

        {/* Outlook */}
        <div>
          <h4 className="font-semibold text-sm mb-2">2-Year Outlook</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.outlook}</p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchAnalysis}>
          Regenerate Analysis
        </Button>
      </CardContent>
    </Card>
  );
}
