'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Props {
  workspaceId: string;
  tables: string[];
}

export function ExportButtons({ workspaceId, tables }: Props) {
  const [exportingTable, setExportingTable] = useState<string | null>(null);
  const [exportingWorkspace, setExportingWorkspace] = useState(false);
  const [error, setError] = useState('');

  const downloadFile = async (url: string, filename: string, setLoading: (v: boolean) => void) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || `Export failed: ${res.status}`);
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const exportTableCsv = (table: string) => {
    downloadFile(
      `${API_BASE}/workspaces/${workspaceId}/tables/${encodeURIComponent(table)}/export?format=csv`,
      `${table}.csv`,
      (v) => setExportingTable(v ? table : null),
    );
  };

  const exportWorkspaceSql = () => {
    downloadFile(
      `${API_BASE}/workspaces/${workspaceId}/export`,
      `workspace-${workspaceId}.sql`,
      setExportingWorkspace,
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">Export</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Download table data as CSV or the entire workspace schema as SQL.
        </p>

        {/* Workspace SQL export */}
        <Button
          size="sm"
          variant="outline"
          onClick={exportWorkspaceSql}
          disabled={exportingWorkspace}
          className="mb-4"
        >
          {exportingWorkspace ? 'Exporting...' : 'Export Workspace as SQL'}
        </Button>
      </div>

      {/* Per-table CSV export */}
      {tables.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Export Table as CSV</p>
          <div className="space-y-1.5">
            {tables.map((table) => (
              <div key={table} className="flex items-center gap-3">
                <span className="text-sm font-mono flex-1 truncate">{table}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => exportTableCsv(table)}
                  disabled={exportingTable === table}
                  className="text-xs h-7 px-2"
                >
                  {exportingTable === table ? 'Downloading...' : 'Export CSV'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tables.length === 0 && (
        <p className="text-xs text-muted-foreground">No tables found in this workspace.</p>
      )}

      {error && (
        <div className="text-sm text-destructive border border-destructive/30 rounded p-2">
          {error}
        </div>
      )}
    </div>
  );
}
