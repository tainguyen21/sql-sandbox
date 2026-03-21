'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { TransactionStateBadge } from './transaction-state-badge';
import { api } from '@/lib/api';

type TxState = 'IDLE' | 'IN TRANSACTION' | 'ERROR';
type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

interface LogEntry {
  id: number;
  type: 'sql' | 'result' | 'error' | 'info';
  content: string;
  rows?: any[];
  rowCount?: number;
  durationMs?: number;
  timestamp: string;
}

interface SessionPanelProps {
  labId: string;
  session: 'a' | 'b';
  label: string;
  /** Optional SQL to prefill from scenario guide */
  prefillSql?: string;
  onPrefillConsumed?: () => void;
}

const ISOLATION_LEVELS: IsolationLevel[] = ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'];

/** Single session panel — SQL input, transaction controls, output log */
export function SessionPanel({ labId, session, label, prefillSql, onPrefillConsumed }: SessionPanelProps) {
  const [sql, setSql] = useState('');
  const [txState, setTxState] = useState<TxState>('IDLE');
  const [isolationLevel, setIsolationLevel] = useState<IsolationLevel>('READ COMMITTED');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const entryCounter = useRef(0);

  // Auto-scroll log to bottom on new entries
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Prefill SQL from scenario guide
  useEffect(() => {
    if (prefillSql) {
      setSql(prefillSql);
      onPrefillConsumed?.();
    }
  }, [prefillSql, onPrefillConsumed]);

  function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
    entryCounter.current += 1;
    setLog((prev) => [
      ...prev,
      { ...entry, id: entryCounter.current, timestamp: new Date().toLocaleTimeString() },
    ]);
  }

  function handleResult(result: any) {
    setTxState(result.txState ?? 'IDLE');
    if (result.error) {
      addLog({ type: 'error', content: result.error });
    } else {
      addLog({
        type: 'result',
        content: `${result.rowCount ?? 0} row(s)`,
        rows: result.rows,
        rowCount: result.rowCount,
        durationMs: result.durationMs,
      });
    }
  }

  async function handleExecute() {
    if (!sql.trim() || loading) return;
    addLog({ type: 'sql', content: sql.trim() });
    setLoading(true);
    try {
      const result = await api.labExecute(labId, session, sql.trim());
      handleResult(result);
    } catch (err: any) {
      addLog({ type: 'error', content: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleBegin() {
    if (loading) return;
    addLog({ type: 'info', content: `BEGIN ISOLATION LEVEL ${isolationLevel}` });
    setLoading(true);
    try {
      const result = await api.labBegin(labId, session, isolationLevel);
      handleResult(result);
    } catch (err: any) {
      addLog({ type: 'error', content: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (loading) return;
    addLog({ type: 'info', content: 'COMMIT' });
    setLoading(true);
    try {
      const result = await api.labCommit(labId, session);
      handleResult(result);
    } catch (err: any) {
      addLog({ type: 'error', content: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleRollback() {
    if (loading) return;
    addLog({ type: 'info', content: 'ROLLBACK' });
    setLoading(true);
    try {
      const result = await api.labRollback(labId, session);
      handleResult(result);
    } catch (err: any) {
      addLog({ type: 'error', content: err.message });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  }

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b">
        <span className="font-semibold text-sm">{label}</span>
        <TransactionStateBadge state={txState} />
      </div>

      {/* SQL textarea */}
      <div className="p-2 border-b">
        <textarea
          className="w-full h-24 font-mono text-sm p-2 rounded border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Enter SQL... (Ctrl+Enter to execute)"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
      </div>

      {/* Isolation level + Execute */}
      <div className="flex items-center gap-2 px-2 py-2 border-b flex-wrap">
        <select
          className="text-xs border rounded px-2 py-1 bg-background"
          value={isolationLevel}
          onChange={(e) => setIsolationLevel(e.target.value as IsolationLevel)}
        >
          {ISOLATION_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>{lvl}</option>
          ))}
        </select>

        <Button size="sm" onClick={handleExecute} disabled={loading || !sql.trim()}>
          Execute
        </Button>
        <Button size="sm" variant="outline" onClick={handleBegin} disabled={loading || txState !== 'IDLE'}>
          BEGIN
        </Button>
        <Button size="sm" variant="outline" onClick={handleCommit} disabled={loading || txState !== 'IN TRANSACTION'}>
          COMMIT
        </Button>
        <Button size="sm" variant="destructive" onClick={handleRollback} disabled={loading || txState === 'IDLE'}>
          ROLLBACK
        </Button>
      </div>

      {/* Output log */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 font-mono text-xs bg-muted/30">
        {log.length === 0 && (
          <p className="text-muted-foreground text-center py-4">No output yet</p>
        )}
        {log.map((entry) => (
          <div key={entry.id} className="space-y-0.5">
            {entry.type === 'sql' && (
              <div className="text-blue-700 dark:text-blue-400">
                <span className="text-muted-foreground">[{entry.timestamp}] </span>
                <span className="font-semibold">SQL:</span> {entry.content}
              </div>
            )}
            {entry.type === 'info' && (
              <div className="text-muted-foreground">
                <span>[{entry.timestamp}]</span> {entry.content}
              </div>
            )}
            {entry.type === 'error' && (
              <div className="text-red-600 dark:text-red-400">
                <span>[{entry.timestamp}]</span> ERROR: {entry.content}
              </div>
            )}
            {entry.type === 'result' && (
              <div>
                <div className="text-green-700 dark:text-green-400">
                  <span className="text-muted-foreground">[{entry.timestamp}]</span>{' '}
                  {entry.content}
                  {entry.durationMs !== undefined && (
                    <span className="text-muted-foreground ml-1">({entry.durationMs}ms)</span>
                  )}
                </div>
                {entry.rows && entry.rows.length > 0 && (
                  <ResultTable rows={entry.rows} />
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

/** Compact result table for log entries */
function ResultTable({ rows }: { rows: any[] }) {
  const columns = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto mt-1">
      <table className="text-xs border-collapse border border-border w-full">
        <thead>
          <tr className="bg-muted">
            {columns.map((col) => (
              <th key={col} className="border border-border px-2 py-0.5 text-left font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, i) => (
            <tr key={i} className="even:bg-muted/30">
              {columns.map((col) => (
                <td key={col} className="border border-border px-2 py-0.5">
                  {row[col] === null ? <span className="text-muted-foreground">NULL</span> : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
          {rows.length > 20 && (
            <tr>
              <td colSpan={columns.length} className="text-center text-muted-foreground py-1">
                ... {rows.length - 20} more rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
