'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SignalBadge } from '@/components/analyzer/signal-badge';

const LAYER_LABELS: Record<number, string> = {
  1: 'Parse & Rewrite', 2: 'Planner', 3: 'Execution',
  4: 'Index', 5: 'Storage', 6: 'Locking', 7: 'Write Path',
};

interface Props {
  suggestion: {
    title: string;
    layer: number;
    problem: string;
    solution: string;
    rewrittenQuery: string | null;
    ddlChanges: string[];
    gucChanges: string[];
    expectedImprovement: string;
    tradeoffs: string[];
  };
  onApplyDdl: (ddl: string) => void;
  onApplyGuc: (guc: string) => void;
  onCopyQuery: (sql: string) => void;
}

export function SuggestionCard({ suggestion: s, onApplyDdl, onApplyGuc, onCopyQuery }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border rounded-md p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
          Layer {s.layer} — {LAYER_LABELS[s.layer] || 'Other'}
        </span>
        <h4 className="font-semibold text-sm flex-1">{s.title}</h4>
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-muted-foreground">
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-destructive">Problem: </span>
              <span>{s.problem}</span>
            </div>
            <div>
              <span className="font-medium text-green-600">Solution: </span>
              <span>{s.solution}</span>
            </div>
          </div>

          {/* Rewritten query */}
          {s.rewrittenQuery && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">Rewritten Query</span>
                <Button size="sm" variant="outline" onClick={() => onCopyQuery(s.rewrittenQuery!)}>
                  Copy to Editor
                </Button>
              </div>
              <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-[150px] font-mono">
                {s.rewrittenQuery}
              </pre>
            </div>
          )}

          {/* DDL changes */}
          {s.ddlChanges.length > 0 && (
            <div>
              <span className="text-xs font-medium">DDL Changes</span>
              {s.ddlChanges.map((ddl, i) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-muted p-1 rounded flex-1 font-mono">{ddl}</code>
                  <Button size="sm" variant="outline" onClick={() => onApplyDdl(ddl)}>Apply</Button>
                </div>
              ))}
            </div>
          )}

          {/* GUC changes */}
          {s.gucChanges.length > 0 && (
            <div>
              <span className="text-xs font-medium">Configuration Changes</span>
              {s.gucChanges.map((guc, i) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-muted p-1 rounded flex-1 font-mono">{guc}</code>
                  <Button size="sm" variant="outline" onClick={() => onApplyGuc(guc)}>Apply</Button>
                </div>
              ))}
            </div>
          )}

          {/* Improvement + Tradeoffs */}
          <div className="text-xs space-y-1">
            <p><strong>Expected:</strong> {s.expectedImprovement}</p>
            {s.tradeoffs.length > 0 && (
              <p><strong>Tradeoffs:</strong> {s.tradeoffs.join('; ')}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
