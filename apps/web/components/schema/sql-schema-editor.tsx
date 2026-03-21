'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Props {
  workspaceId: string;
  onSuccess: () => void;
}

/**
 * Basic SQL editor for DDL execution.
 * Uses a textarea for now — Monaco Editor will be added in Phase 03.
 */
export function SqlSchemaEditor({ workspaceId, onSuccess }: Props) {
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      await api.executeDdl(workspaceId, sql.trim());
      setResult({ success: true });
      onSuccess();
    } catch (err: any) {
      setResult({ error: err.message || 'Execution failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter to execute
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">SQL Editor</h3>
        <span className="text-xs text-muted-foreground">Ctrl+Enter to run</span>
      </div>
      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full h-40 px-3 py-2 border rounded-md bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        placeholder="CREATE TABLE users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE
);"
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <Button onClick={handleExecute} disabled={loading || !sql.trim()} size="sm">
          {loading ? 'Running...' : 'Execute'}
        </Button>
        {result?.success && (
          <span className="text-sm text-green-600">DDL executed successfully</span>
        )}
        {result?.error && (
          <span className="text-sm text-destructive">{result.error}</span>
        )}
      </div>
    </div>
  );
}
