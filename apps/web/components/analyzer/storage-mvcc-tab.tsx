'use client';

import { SignalBadge } from './signal-badge';

interface Props {
  tableStorageStats: any[];
  signals: any[];
}

export function StorageMvccTab({ tableStorageStats, signals }: Props) {
  const layer5Signals = signals.filter((s: any) => s.layer === 5);

  if (tableStorageStats.length === 0) {
    return <div className="text-sm text-muted-foreground p-4">No table storage data available.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Per-table storage stats */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Table Storage & MVCC</h4>
        <div className="space-y-3">
          {tableStorageStats.map((ts: any) => {
            const live = ts.n_live_tup || 0;
            const dead = ts.n_dead_tup || 0;
            const total = live + dead;
            const deadRatio = total > 0 ? (dead / total) * 100 : 0;
            const barColor = deadRatio > 50 ? 'bg-red-500' : deadRatio > 20 ? 'bg-yellow-500' : 'bg-green-500';

            return (
              <div key={ts.table_name} className="border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-semibold">{ts.table_name}</h5>
                  <span className="text-xs text-muted-foreground">{ts.table_size}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Stat label="Live Tuples" value={live.toLocaleString()} />
                  <Stat label="Dead Tuples" value={dead.toLocaleString()} />
                  <Stat label="Seq Scans" value={ts.seq_scan?.toLocaleString()} />
                  <Stat label="Index Scans" value={ts.idx_scan?.toLocaleString()} />
                </div>

                {/* Dead tuple ratio bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span>Dead tuple ratio</span>
                    <span className="font-mono">{deadRatio.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all`}
                      style={{ width: `${Math.min(deadRatio, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <span>Last Analyze: {ts.last_analyze ? new Date(ts.last_analyze).toLocaleString() : 'Never'}</span>
                  <span>Last Autovacuum: {ts.last_autovacuum ? new Date(ts.last_autovacuum).toLocaleString() : 'Never'}</span>
                  <span>HOT Updates: {ts.n_tup_hot_upd?.toLocaleString() || 0}</span>
                  <span>Pages: {ts.relpages}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HOT Update Explanation */}
      <div className="border rounded-md p-4 bg-muted/30">
        <h4 className="text-sm font-semibold mb-1">What are HOT Updates?</h4>
        <p className="text-xs text-muted-foreground">
          Heap-Only Tuple (HOT) updates are an optimization where PostgreSQL can update a row
          without modifying any indexes, as long as (1) the updated columns are not indexed,
          and (2) the new tuple fits on the same page. HOT updates are much faster because
          they avoid index maintenance overhead. A high ratio of HOT to total updates indicates
          efficient update patterns.
        </p>
      </div>

      {/* Layer 5 Signals */}
      {layer5Signals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Storage Signals</h4>
          {layer5Signals.map((s: any, i: number) => (
            <div key={i} className="border rounded p-3 space-y-1">
              <SignalBadge type={s.type} severity={s.severity} />
              <p className="text-xs">{s.explanation}</p>
              <p className="text-xs text-muted-foreground"><strong>Suggestion:</strong> {s.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="font-mono text-sm">{value ?? '-'}</p>
    </div>
  );
}
