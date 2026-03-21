'use client';

import { useState, useCallback } from 'react';
import { MonacoSqlEditor } from './monaco-sql-editor';
import { QueryResultsTable } from './query-results-table';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface Props {
  workspaceId: string;
  /** Called after each query execution (for refreshing history) */
  onQueryExecuted?: () => void;
  /** Initial SQL to load into editor */
  initialSql?: string;
}

export function SqlEditorPanel({ workspaceId, onQueryExecuted, initialSql }: Props) {
  const [sql, setSql] = useState(initialSql || '');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const executeQuery = useCallback(
    async (page = 1) => {
      if (!sql.trim()) return;
      setLoading(true);
      try {
        const data = await api.executeQuery(workspaceId, sql.trim(), page);
        setResult(data);
      } catch (err: any) {
        setResult({ columns: [], rows: [], rowCount: 0, durationMs: 0, page: 1, totalPages: 0, error: err.message });
      } finally {
        setLoading(false);
        onQueryExecuted?.();
      }
    },
    [workspaceId, sql, onQueryExecuted],
  );

  const handleSaveSnippet = async () => {
    if (!saveName.trim() || !sql.trim()) return;
    try {
      await api.saveSnippet(workspaceId, { name: saveName.trim(), sql: sql.trim() });
      setShowSave(false);
      setSaveName('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">SQL Editor</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ctrl+Enter to run · Ctrl+Shift+F to format</span>
          <Button size="sm" variant="outline" onClick={() => setShowSave(!showSave)}>
            Save Snippet
          </Button>
          <Button size="sm" onClick={() => executeQuery()} disabled={loading || !sql.trim()}>
            {loading ? 'Running...' : 'Execute'}
          </Button>
        </div>
      </div>

      {/* Save snippet input */}
      {showSave && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            className="flex-1 px-2 py-1 border rounded text-sm bg-background"
            placeholder="Snippet name..."
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSaveSnippet()}
          />
          <Button size="sm" onClick={handleSaveSnippet} disabled={!saveName.trim()}>
            Save
          </Button>
        </div>
      )}

      {/* Monaco editor */}
      <div className="border rounded-md overflow-hidden">
        <MonacoSqlEditor
          value={sql}
          onChange={setSql}
          onExecute={() => executeQuery()}
        />
      </div>

      {/* Results */}
      <QueryResultsTable
        result={result}
        loading={loading}
        onPageChange={(page) => executeQuery(page)}
      />
    </div>
  );
}
