'use client';

import { SignalBadge } from './signal-badge';
import { NODE_TYPE_LABELS } from '@sql-sandbox/shared';

interface Props {
  node: any;
}

/** Explanations for common plan node types */
const NODE_EXPLANATIONS: Record<string, string> = {
  'Seq Scan': 'Reads every row in the table sequentially. Fast for small tables but expensive for large ones without matching indexes.',
  'Index Scan': 'Uses an index to find matching rows, then fetches full rows from the table. Efficient for selective queries.',
  'Index Only Scan': 'Reads data directly from the index without accessing the table. The fastest scan type when all needed columns are in the index.',
  'Bitmap Heap Scan': 'First builds a bitmap of matching row locations using an index, then fetches those rows. Good for medium selectivity.',
  'Bitmap Index Scan': 'Scans an index to build a bitmap of row locations. Always paired with Bitmap Heap Scan above it.',
  'Nested Loop': 'For each row from the outer side, scans the inner side. Efficient when the inner side uses an index.',
  'Hash Join': 'Builds a hash table from one input, then probes it with the other. Good for equi-joins on larger datasets.',
  'Merge Join': 'Merges two pre-sorted inputs. Very efficient when both sides are already sorted (e.g., from index scans).',
  Sort: 'Sorts rows by the specified key(s). If data exceeds work_mem, it spills to disk (external sort).',
  Hash: 'Builds an in-memory hash table. If data exceeds work_mem, it uses multiple batches.',
  Aggregate: 'Computes aggregate functions (COUNT, SUM, AVG, etc.) over grouped rows.',
  Limit: 'Stops after returning the specified number of rows. Can dramatically reduce work if placed early in the plan.',
  'CTE Scan': 'Scans the result of a Common Table Expression (WITH clause). The CTE is materialized as a temporary result.',
};

export function PlanNodeDetail({ node }: Props) {
  if (!node) {
    return <div className="text-sm text-muted-foreground p-4">Click a node to view details.</div>;
  }

  const explanation = NODE_EXPLANATIONS[node.nodeType] || 'Execution plan node.';

  return (
    <div className="border rounded-md p-4 space-y-4 text-sm overflow-auto max-h-[500px]">
      <div>
        <h3 className="font-semibold text-base">
          {NODE_TYPE_LABELS[node.nodeType] || node.nodeType}
        </h3>
        <p className="text-muted-foreground mt-1">{explanation}</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Estimated Rows" value={node.planRows} />
        <Metric label="Actual Rows" value={node.actualRows} />
        <Metric label="Startup Cost" value={node.startupCost?.toFixed(2)} />
        <Metric label="Total Cost" value={node.totalCost?.toFixed(2)} />
        <Metric label="Actual Time" value={node.actualTotalTime != null ? `${node.actualTotalTime.toFixed(2)}ms` : undefined} />
        <Metric label="Loops" value={node.actualLoops} />
        <Metric label="Buffer Hits" value={node.sharedHitBlocks} />
        <Metric label="Buffer Reads" value={node.sharedReadBlocks} />
        <Metric label="Cost Ratio" value={`${Math.round(node.costRatio * 100)}%`} />
      </div>

      {/* Conditions */}
      {node.filter && <Detail label="Filter" value={node.filter} />}
      {node.indexCondition && <Detail label="Index Condition" value={node.indexCondition} />}
      {node.hashCondition && <Detail label="Hash Condition" value={node.hashCondition} />}
      {node.joinFilter && <Detail label="Join Filter" value={node.joinFilter} />}
      {node.sortKey && <Detail label="Sort Key" value={node.sortKey.join(', ')} />}
      {node.sortMethod && <Detail label="Sort Method" value={node.sortMethod} />}
      {node.indexName && <Detail label="Index" value={node.indexName} />}
      {node.relationName && <Detail label="Table" value={node.relationName} />}

      {/* Signals */}
      {node.signals.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Signals</h4>
          <div className="space-y-2">
            {node.signals.map((s: any, i: number) => (
              <div key={i} className="border rounded p-2 space-y-1">
                <SignalBadge type={s.type} severity={s.severity} />
                <p className="text-xs mt-1">{s.explanation}</p>
                <p className="text-xs text-muted-foreground"><strong>Suggestion:</strong> {s.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  if (value == null) return null;
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}:</span>
      <code className="block text-xs bg-muted p-1 rounded mt-0.5 font-mono">{value}</code>
    </div>
  );
}
