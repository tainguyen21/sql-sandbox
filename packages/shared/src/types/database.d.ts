export type SignalSeverity = 'info' | 'warning' | 'critical';
export type SignalType = 'cte_fence' | 'bad_estimate' | 'stale_stats' | 'suboptimal_guc' | 'disk_spill' | 'seq_scan_candidate' | 'nested_loop_risk' | 'expensive_sort' | 'unused_index' | 'index_type_mismatch' | 'dead_tuple_bloat' | 'vacuum_needed' | 'lock_acquired' | 'wal_amplification';
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
export declare const NODE_TYPE_LABELS: Record<string, string>;
