/** A single optimization suggestion from the AI */
export interface OptimizationSuggestion {
  title: string;
  layer: number;
  problem: string;
  solution: string;
  rewrittenQuery: string | null;
  ddlChanges: string[];
  gucChanges: string[];
  expectedImprovement: string;
  tradeoffs: string[];
}

/** A/B comparison metric */
export interface ComparisonMetric {
  name: string;
  valueA: number | string | null;
  valueB: number | string | null;
  winner: 'A' | 'B' | 'tie';
  improvement: string;
}

/** Full A/B comparison result */
export interface ComparisonResult {
  queryA: string;
  queryB: string;
  metrics: ComparisonMetric[];
  signalsOnlyA: any[];
  signalsOnlyB: any[];
  signalsBoth: any[];
  resultA: any;
  resultB: any;
}
