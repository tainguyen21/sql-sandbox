'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type IndexType = 'btree' | 'hash' | 'gin' | 'gist' | 'brin';

interface Props {
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
}

const INDEX_TYPES: { value: IndexType; label: string; description: string }[] = [
  { value: 'btree', label: 'B-Tree', description: 'Default. Equality and range queries.' },
  { value: 'hash', label: 'Hash', description: 'Fast equality lookups only.' },
  { value: 'gin', label: 'GIN', description: 'Array, JSONB, full-text search.' },
  { value: 'gist', label: 'GiST', description: 'Geometric, range types, full-text.' },
  { value: 'brin', label: 'BRIN', description: 'Very large tables with natural ordering.' },
];

/** Build a preview DDL string from current form state */
function buildPreviewDdl(
  tableName: string,
  selectedCols: string[],
  indexType: IndexType,
  unique: boolean,
  concurrently: boolean,
  whereClause: string,
): string {
  if (!tableName || selectedCols.length === 0) return '';
  const colSlug = selectedCols.join('_').substring(0, 30);
  const name = `idx_${tableName}_${colSlug}_${indexType}`;
  const parts = ['CREATE'];
  if (unique) parts.push('UNIQUE');
  parts.push('INDEX');
  if (concurrently) parts.push('CONCURRENTLY');
  parts.push(`"${name}"`);
  parts.push(`ON "${tableName}"`);
  parts.push(`USING ${indexType}`);
  parts.push(`(${selectedCols.map((c) => `"${c}"`).join(', ')})`);
  if (whereClause.trim()) parts.push(`WHERE ${whereClause.trim()}`);
  return parts.join(' ');
}

export function CreateIndexModal({ workspaceId, onClose, onCreated }: Props) {
  const [tables, setTables] = useState<string[]>([]);
  const [tableName, setTableName] = useState('');
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [indexType, setIndexType] = useState<IndexType>('btree');
  const [unique, setUnique] = useState(false);
  const [concurrently, setConcurrently] = useState(true);
  const [whereClause, setWhereClause] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load tables on mount
  useEffect(() => {
    api.getTables(workspaceId).then(setTables).catch(() => {});
  }, [workspaceId]);

  // Load columns when table changes
  useEffect(() => {
    if (!tableName) { setTableColumns([]); setSelectedCols([]); return; }
    api.getTableDetail(workspaceId, tableName)
      .then((detail) => {
        const cols = (detail.columns ?? []).map((c: any) => c.columnName ?? c.column_name ?? c.name ?? c);
        setTableColumns(cols);
        setSelectedCols([]);
      })
      .catch(() => setTableColumns([]));
  }, [workspaceId, tableName]);

  const toggleColumn = (col: string) => {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const previewDdl = buildPreviewDdl(tableName, selectedCols, indexType, unique, concurrently, whereClause);

  const handleSubmit = async () => {
    if (!tableName || selectedCols.length === 0) {
      setError('Select a table and at least one column.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.createIndex(workspaceId, {
        tableName,
        columns: selectedCols,
        indexType,
        unique,
        concurrently,
        whereClause: whereClause.trim() || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create index');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Index</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        {/* Step 1: Table */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Table</label>
          <select
            className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
          >
            <option value="">-- select table --</option>
            {tables.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Step 2: Columns */}
        {tableColumns.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Columns <span className="text-muted-foreground">(select one or more for composite)</span></label>
            <div className="border rounded p-2 max-h-36 overflow-y-auto space-y-1">
              {tableColumns.map((col) => (
                <label key={col} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCols.includes(col)}
                    onChange={() => toggleColumn(col)}
                  />
                  {col}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Index type */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Index Type</label>
          <div className="grid grid-cols-3 gap-2">
            {INDEX_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                title={t.description}
                onClick={() => setIndexType(t.value)}
                className={`text-xs border rounded px-2 py-1.5 transition-colors ${
                  indexType === t.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-accent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: Options */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
            Unique
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={concurrently} onChange={(e) => setConcurrently(e.target.checked)} />
            CONCURRENTLY (non-blocking)
          </label>
        </div>

        {/* Partial WHERE clause */}
        <div className="space-y-1">
          <label className="text-sm font-medium">WHERE clause <span className="text-muted-foreground">(optional, for partial index)</span></label>
          <input
            type="text"
            className="w-full border rounded px-3 py-1.5 text-sm font-mono bg-background"
            placeholder="e.g. deleted_at IS NULL"
            value={whereClause}
            onChange={(e) => setWhereClause(e.target.value)}
          />
        </div>

        {/* DDL preview */}
        {previewDdl && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">DDL Preview</label>
            <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">{previewDdl}</pre>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !tableName || selectedCols.length === 0}>
            {loading ? 'Creating...' : 'Create Index'}
          </Button>
        </div>
      </div>
    </div>
  );
}
