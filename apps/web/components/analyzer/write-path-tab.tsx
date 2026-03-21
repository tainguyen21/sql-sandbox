'use client';

interface WalStats {
  walDelta: number;
  walBytesBefore: number;
  walBytesAfter: number;
}

interface Props {
  walStats: WalStats | null;
  isDml: boolean;
  signals: any[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function WritePathTab({ walStats, isDml, signals }: Props) {
  const walSignals = signals.filter((s) => s.layer === 7);

  if (!isDml) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        WAL data is only collected for DML queries (INSERT, UPDATE, DELETE, TRUNCATE).
      </div>
    );
  }

  if (!walStats) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No WAL data available. Run Full Analysis on a DML query to see WAL metrics.
      </div>
    );
  }

  const walDelta = walStats.walDelta;

  return (
    <div className="space-y-4">
      {/* WAL signals */}
      {walSignals.length > 0 && (
        <div className="space-y-2">
          {walSignals.map((s, i) => (
            <div
              key={i}
              className={`rounded p-3 text-sm border ${
                s.severity === 'critical'
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : s.severity === 'warning'
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400'
              }`}
            >
              <p className="font-medium">{s.message}</p>
              {s.explanation && <p className="mt-1 text-xs opacity-80">{s.explanation}</p>}
              {s.suggestion && <p className="mt-1 text-xs font-medium">{s.suggestion}</p>}
            </div>
          ))}
        </div>
      )}

      {/* WAL metrics */}
      <div>
        <h3 className="text-sm font-semibold mb-3">WAL Write Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            label="WAL Generated"
            value={formatBytes(walDelta)}
            description="Bytes written to Write-Ahead Log during this DML"
            highlight={walDelta > 1024 * 1024}
          />
          <MetricCard
            label="WAL Before"
            value={formatBytes(walStats.walBytesBefore)}
            description="Cumulative WAL bytes before query execution"
          />
          <MetricCard
            label="WAL After"
            value={formatBytes(walStats.walBytesAfter)}
            description="Cumulative WAL bytes after query execution"
          />
        </div>
      </div>

      {/* WAL explainer */}
      <div className="rounded border p-4 bg-muted/30 text-xs space-y-2 text-muted-foreground">
        <p className="font-semibold text-foreground text-sm">About WAL (Write-Ahead Log)</p>
        <p>
          PostgreSQL writes every data change to WAL before modifying the actual table pages.
          This ensures crash recovery and powers streaming replication.
        </p>
        <p>
          <span className="font-medium text-foreground">High WAL amplification</span> means the
          WAL volume is much larger than the data changed. Common causes: full-page writes after
          a checkpoint, TOAST column updates, triggers writing to other tables.
        </p>
        <p>
          <span className="font-medium text-foreground">Impact on replicas:</span> WAL volume
          directly affects replication lag. Large writes increase lag on standby servers.
        </p>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  highlight?: boolean;
}

function MetricCard({ label, value, description, highlight }: MetricCardProps) {
  return (
    <div
      className={`rounded border p-3 space-y-1 ${
        highlight ? 'border-yellow-500/50 bg-yellow-500/5' : 'bg-muted/20'
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold font-mono ${highlight ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
