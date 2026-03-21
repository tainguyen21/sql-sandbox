'use client';

interface LockSnapshot {
  locktype: string;
  relation: string | null;
  mode: string;
  granted: boolean;
}

interface Props {
  locks: LockSnapshot[];
  signals: any[];
}

/** Lock modes that conflict with concurrent reads */
const BLOCKING_MODES = new Set([
  'ShareLock',
  'ShareRowExclusiveLock',
  'ExclusiveLock',
  'AccessExclusiveLock',
]);

/** Human-readable description for lock modes */
const LOCK_MODE_DESC: Record<string, string> = {
  AccessShareLock: 'SELECT',
  RowShareLock: 'SELECT FOR UPDATE/SHARE',
  RowExclusiveLock: 'INSERT / UPDATE / DELETE',
  ShareUpdateExclusiveLock: 'VACUUM / ANALYZE / CREATE INDEX CONCURRENTLY',
  ShareLock: 'CREATE INDEX (non-concurrent)',
  ShareRowExclusiveLock: 'CREATE TRIGGER / ALTER TABLE',
  ExclusiveLock: 'Refresh Materialized View',
  AccessExclusiveLock: 'ALTER TABLE / DROP / TRUNCATE / VACUUM FULL',
};

export function LocksTab({ locks, signals }: Props) {
  const lockSignals = signals.filter((s) => s.layer === 6);

  if (locks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No relation locks detected for this query.
        <p className="mt-1 text-xs">Lock data is only available in Full Analysis mode.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Lock signals */}
      {lockSignals.length > 0 && (
        <div className="space-y-2">
          {lockSignals.map((s, i) => (
            <div
              key={i}
              className={`rounded p-3 text-sm border ${
                s.severity === 'critical'
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
              }`}
            >
              <p className="font-medium">{s.message}</p>
              {s.suggestion && <p className="mt-1 text-xs opacity-80">{s.suggestion}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Lock snapshot table */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Lock Snapshot ({locks.length} locks)</h3>
        <div className="overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Relation</th>
                <th className="text-left px-3 py-2 font-medium">Lock Type</th>
                <th className="text-left px-3 py-2 font-medium">Mode</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Typical Operation</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {locks.map((lock, i) => {
                const isBlocking = BLOCKING_MODES.has(lock.mode);
                const isWaiting = !lock.granted;
                return (
                  <tr
                    key={i}
                    className={
                      isWaiting
                        ? 'bg-destructive/10 text-destructive'
                        : isBlocking
                        ? 'bg-yellow-500/5 text-yellow-700 dark:text-yellow-400'
                        : ''
                    }
                  >
                    <td className="px-3 py-2 font-mono">
                      {lock.relation ?? <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-3 py-2">{lock.locktype}</td>
                    <td className="px-3 py-2 font-medium">{lock.mode}</td>
                    <td className="px-3 py-2">
                      {isWaiting ? (
                        <span className="text-destructive font-semibold">WAITING</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">Granted</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {LOCK_MODE_DESC[lock.mode] ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Locks highlighted in yellow block concurrent reads. Red rows indicate waiting locks (contention).
        </p>
      </div>
    </div>
  );
}
