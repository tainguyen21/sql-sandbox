/** Severity levels for analyzer signals */
export type SignalSeverity = 'info' | 'warning' | 'critical';

/** Signal types across all 7 analyzer layers */
export type SignalType =
  | 'cte_fence'
  | 'bad_estimate'
  | 'stale_stats'
  | 'suboptimal_guc'
  | 'disk_spill'
  | 'seq_scan_candidate'
  | 'nested_loop_risk'
  | 'expensive_sort'
  | 'unused_index'
  | 'index_type_mismatch'
  | 'dead_tuple_bloat'
  | 'vacuum_needed'
  | 'lock_acquired'
  | 'wal_amplification';

/** A signal detected during query analysis */
export interface PlanSignal {
  layer: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  type: SignalType;
  severity: SignalSeverity;
  nodeType?: string;
  table?: string;
  message: string;
  explanation: string;
  suggestion: string;
}

/** Node types commonly seen in EXPLAIN output */
export const NODE_TYPE_LABELS: Record<string, string> = {
  'Seq Scan': 'Sequential Scan',
  'Index Scan': 'Index Scan',
  'Index Only Scan': 'Index-Only Scan',
  'Bitmap Heap Scan': 'Bitmap Heap Scan',
  'Bitmap Index Scan': 'Bitmap Index Scan',
  'Nested Loop': 'Nested Loop Join',
  'Hash Join': 'Hash Join',
  'Merge Join': 'Merge Join',
  Sort: 'Sort',
  Hash: 'Hash',
  Aggregate: 'Aggregate',
  'Group Aggregate': 'Group Aggregate',
  'Hash Aggregate': 'Hash Aggregate',
  Limit: 'Limit',
  'CTE Scan': 'CTE Scan',
  Materialize: 'Materialize',
  Append: 'Append',
  'Merge Append': 'Merge Append',
  Result: 'Result',
  'Subquery Scan': 'Subquery Scan',
  Gather: 'Gather',
  'Gather Merge': 'Gather Merge',
};
