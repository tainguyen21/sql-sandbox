'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface HistoryEntry {
  id: string;
  sql: string;
  durationMs: number | null;
  rowCount: number | null;
  error: string | null;
  executedAt: string;
}

interface Props {
  workspaceId: string;
  onLoadSql: (sql: string) => void;
  refreshKey?: number;
}

export function QueryHistoryPanel({ workspaceId, onLoadSql, refreshKey }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getQueryHistory(workspaceId, search || undefined)
      .then((data) => setEntries(data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId, search, refreshKey]);

  return (
    <div className="border rounded-md p-3 space-y-2">
      <h3 className="text-sm font-semibold">Query History</h3>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-2 py-1 border rounded text-sm bg-background"
        placeholder="Search queries..."
      />
      {loading && <p className="text-xs text-muted-foreground">Loading...</p>}
      <ul className="space-y-1 max-h-[300px] overflow-auto">
        {entries.map((e) => (
          <li
            key={e.id}
            className="px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer text-xs group"
            onClick={() => onLoadSql(e.sql)}
          >
            <code className="block truncate font-mono">{e.sql}</code>
            <span className="text-muted-foreground">
              {e.durationMs != null ? `${e.durationMs}ms` : ''}
              {e.rowCount != null ? ` · ${e.rowCount} rows` : ''}
              {e.error ? ' · ERROR' : ''}
              {' · '}
              {new Date(e.executedAt).toLocaleTimeString()}
            </span>
          </li>
        ))}
        {!loading && entries.length === 0 && (
          <p className="text-xs text-muted-foreground">No history yet.</p>
        )}
      </ul>
    </div>
  );
}
