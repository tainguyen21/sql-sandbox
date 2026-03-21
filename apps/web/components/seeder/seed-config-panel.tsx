'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

const LOCALES = ['en', 'de', 'fr', 'es', 'pt_BR', 'ja', 'ko', 'zh_CN', 'ar', 'ru'];

interface SeedPreviewRow {
  [col: string]: any;
}

interface Props {
  workspaceId: string;
  tables: string[];
}

export function SeedConfigPanel({ workspaceId, tables }: Props) {
  const [rowCount, setRowCount] = useState(50);
  const [locale, setLocale] = useState('en');
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, SeedPreviewRow[]> | null>(null);
  const [previewTable, setPreviewTable] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');

  // Default: all tables selected
  useEffect(() => {
    setSelectedTables(tables);
    setPreviewTable(tables[0] || '');
  }, [tables]);

  const toggleTable = (t: string) =>
    setSelectedTables((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );

  const handlePreview = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.previewSeed(workspaceId, {
        rowCount,
        locale,
        tables: selectedTables.length > 0 ? selectedTables : undefined,
      });
      setPreview(data.preview);
      if (!previewTable || !data.preview[previewTable]) {
        setPreviewTable(Object.keys(data.preview)[0] || '');
      }
    } catch (err: any) {
      setError(err.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!confirm(`Insert ${rowCount} rows into ${selectedTables.length || 'all'} table(s)?`)) return;
    setSeeding(true);
    setError('');
    setResult(null);
    try {
      const data = await api.seedWorkspace(workspaceId, {
        rowCount,
        locale,
        tables: selectedTables.length > 0 ? selectedTables : undefined,
      });
      setResult(data.seeded);
    } catch (err: any) {
      setError(err.message || 'Seeding failed');
    } finally {
      setSeeding(false);
    }
  };

  const previewRows = preview && previewTable ? preview[previewTable] : null;
  const previewCols = previewRows && previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Row count */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Rows per table</label>
          <input
            type="number"
            min={1}
            max={100000}
            value={rowCount}
            onChange={(e) => setRowCount(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm bg-background w-24"
          />
        </div>

        {/* Locale */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Locale</label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-background"
          >
            {LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={loading || tables.length === 0}>
            {loading ? 'Loading...' : 'Preview'}
          </Button>
          <Button size="sm" onClick={handleSeed} disabled={seeding || tables.length === 0}>
            {seeding ? 'Seeding...' : 'Seed'}
          </Button>
        </div>
      </div>

      {/* Table selector */}
      {tables.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Tables to seed</p>
          <div className="flex flex-wrap gap-2">
            {tables.map((t) => (
              <label key={t} className="flex items-center gap-1 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedTables.includes(t)}
                  onChange={() => toggleTable(t)}
                />
                <span className="font-mono">{t}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Seed result */}
      {result && (
        <div className="border rounded p-3 space-y-1">
          <p className="text-sm font-medium">Seeded successfully</p>
          {Object.entries(result).map(([tbl, count]) => (
            <p key={tbl} className="text-xs font-mono text-muted-foreground">
              {tbl}: {count} rows inserted
            </p>
          ))}
        </div>
      )}

      {/* Preview table */}
      {preview && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Preview</p>
            <select
              value={previewTable}
              onChange={(e) => setPreviewTable(e.target.value)}
              className="border rounded px-2 py-1 text-xs bg-background"
            >
              {Object.keys(preview).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {previewRows && previewRows.length > 0 && (
            <div className="overflow-auto border rounded">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted">
                    {previewCols.map((col) => (
                      <th key={col} className="px-2 py-1 text-left font-mono">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/40">
                      {previewCols.map((col) => (
                        <td key={col} className="px-2 py-1 font-mono max-w-[150px] truncate">
                          {row[col] === null ? <span className="text-muted-foreground">NULL</span> : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
