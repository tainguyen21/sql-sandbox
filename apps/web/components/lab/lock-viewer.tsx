'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface LockRow {
  pid: number;
  session: 'A' | 'B' | 'other';
  locktype: string;
  relation: string | null;
  mode: string;
  granted: boolean;
  state: string | null;
  query: string | null;
}

interface LockViewerProps {
  labId: string;
  /** Poll interval in ms — defaults to 2000 */
  pollIntervalMs?: number;
}

/**
 * Polls GET /labs/:id/locks every pollIntervalMs and displays a live lock table.
 * Highlights blocked locks (granted=false) in red.
 */
export function LockViewer({ labId, pollIntervalMs = 2000 }: LockViewerProps) {
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [pidA, setPidA] = useState<number | null>(null);
  const [pidB, setPidB] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const data = await api.labGetLocks(labId);
        setLocks(data.locks ?? []);
        setPidA(data.pidA ?? null);
        setPidB(data.pidB ?? null);
        setLastUpdated(new Date().toLocaleTimeString());
        setError('');
      } catch (err: any) {
        setError(err.message);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [labId, pollIntervalMs]);

  const blockedCount = locks.filter((l) => !l.granted).length;

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Lock Viewer</span>
          {blockedCount > 0 && (
            <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-0.5 rounded border border-red-300">
              {blockedCount} blocked
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {pidA && <span>Session A: PID {pidA}</span>}
          {pidB && <span>Session B: PID {pidB}</span>}
          {lastUpdated && <span>Updated: {lastUpdated}</span>}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="px-3 py-2 text-sm text-red-600 bg-red-50 border-b">{error}</div>
      )}

      {/* Lock table */}
      <div className="overflow-x-auto">
        {locks.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-6">
            No locks held by lab sessions
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted text-left">
                <th className="px-3 py-2 font-medium border-b">Session</th>
                <th className="px-3 py-2 font-medium border-b">PID</th>
                <th className="px-3 py-2 font-medium border-b">Lock Type</th>
                <th className="px-3 py-2 font-medium border-b">Relation</th>
                <th className="px-3 py-2 font-medium border-b">Mode</th>
                <th className="px-3 py-2 font-medium border-b">Granted</th>
                <th className="px-3 py-2 font-medium border-b">State</th>
              </tr>
            </thead>
            <tbody>
              {locks.map((lock, i) => (
                <tr
                  key={i}
                  className={
                    !lock.granted
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                      : 'even:bg-muted/30'
                  }
                >
                  <td className="px-3 py-1.5 border-b font-semibold">
                    {lock.session === 'A' ? (
                      <span className="text-blue-700 dark:text-blue-400">Session A</span>
                    ) : lock.session === 'B' ? (
                      <span className="text-purple-700 dark:text-purple-400">Session B</span>
                    ) : (
                      <span className="text-muted-foreground">other</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 border-b font-mono">{lock.pid}</td>
                  <td className="px-3 py-1.5 border-b">{lock.locktype}</td>
                  <td className="px-3 py-1.5 border-b font-mono">
                    {lock.relation ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-1.5 border-b">{lock.mode}</td>
                  <td className="px-3 py-1.5 border-b">
                    {lock.granted ? (
                      <span className="text-green-700 font-semibold">yes</span>
                    ) : (
                      <span className="text-red-600 font-semibold">WAITING</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 border-b text-muted-foreground">
                    {lock.state ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
