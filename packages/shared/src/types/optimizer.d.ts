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
export interface ComparisonMetric {
    name: string;
    valueA: number | string | null;
    valueB: number | string | null;
    winner: 'A' | 'B' | 'tie';
    improvement: string;
}
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
