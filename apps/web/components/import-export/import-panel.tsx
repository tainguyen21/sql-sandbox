'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface SchemaColumn {
  name: string;
  type: string;
}

interface ImportResult {
  tableName: string;
  rowsInserted: number;
  columns: SchemaColumn[];
}

interface Props {
  workspaceId: string;
  onImported?: () => void;
}

export function ImportPanel({ workspaceId, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [tableName, setTableName] = useState('');
  const [preview, setPreview] = useState<SchemaColumn[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setResult(null);
    setError('');

    if (selected) {
      // Auto-fill table name from filename
      const derived = selected.name
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^(\d)/, '_$1')
        .slice(0, 63);
      setTableName(derived);

      // Fetch schema preview
      setPreviewing(true);
      try {
        const schema = await api.previewImport(workspaceId, selected);
        setPreview(schema);
      } catch (err: any) {
        setError(err.message || 'Failed to preview CSV schema');
      } finally {
        setPreviewing(false);
      }
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.importCsv(workspaceId, file, tableName || undefined);
      setResult(res);
      onImported?.();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTableName('');
    setPreview(null);
    setResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">Import CSV</h3>
        <p className="text-xs text-muted-foreground">
          Upload a CSV file to create a new table. Column types are inferred automatically.
        </p>
      </div>

      {/* File picker */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-muted-foreground">CSV File</label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="block text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-border file:text-xs file:bg-background file:cursor-pointer"
        />
      </div>

      {/* Table name */}
      {file && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">Table Name</label>
          <input
            type="text"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="my_table"
            className="w-full max-w-xs rounded border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Schema preview */}
      {previewing && (
        <p className="text-xs text-muted-foreground">Inferring schema...</p>
      )}

      {preview && preview.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2">Inferred Schema ({preview.length} columns)</p>
          <div className="rounded border overflow-auto max-h-48">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Column</th>
                  <th className="text-left px-3 py-1.5 font-medium">Inferred Type</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.map((col, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-mono">{col.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{col.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive border border-destructive/30 rounded p-2">
          {error}
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="rounded border border-green-500/30 bg-green-500/10 p-3 text-sm">
          <p className="font-medium text-green-700 dark:text-green-400">
            Import complete: {result.rowsInserted} rows inserted into{' '}
            <span className="font-mono">{result.tableName}</span>
          </p>
          <Button size="sm" variant="outline" className="mt-2" onClick={handleReset}>
            Import Another File
          </Button>
        </div>
      )}

      {/* Actions */}
      {file && !result && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleImport}
            disabled={loading || !tableName.trim()}
          >
            {loading ? 'Importing...' : 'Import'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} disabled={loading}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
