'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CreateIndexModal } from './create-index-modal';
import type { IndexInfo } from '@sql-sandbox/shared';

interface Props {
  workspaceId: string;
}

/** Badge shown when an index has never been scanned and the table has >1000 rows */
function UnusedBadge() {
  return (
    <span className="inline-block text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded px-1.5 py-0.5 font-medium">
      Unused
    </span>
  );
}

export function IndexManagerPanel({ workspaceId }: Props) {
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  const fetchIndexes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listIndexes(workspaceId);
      setIndexes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load indexes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIndexes();
  }, [workspaceId]);

  const handleDrop = async (indexName: string) => {
    if (!confirm(`Drop index "${indexName}"? This cannot be undone.`)) return;
    try {
      await api.dropIndex(workspaceId, indexName);
      fetchIndexes();
    } catch (err: any) {
      alert(err.message || 'Failed to drop index');
    }
  };

  const isUnused = (idx: IndexInfo) => idx.idxScan === 0 && idx.tableRows > 1000;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Indexes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            All indexes in this workspace with usage statistics
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          + Create Index
        </Button>
      </div>

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Loading */}
      {loading && <p className="text-sm text-muted-foreground">Loading indexes...</p>}

      {/* Empty state */}
      {!loading && indexes.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          No indexes found. Create one to improve query performance.
        </p>
      )}

      {/* Index table */}
      {!loading && indexes.length > 0 && (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Table</th>
                <th className="text-left px-3 py-2">Columns</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Size</th>
                <th className="text-right px-3 py-2">Scans</th>
                <th className="text-right px-3 py-2">Tup Read</th>
                <th className="text-right px-3 py-2">Tup Fetch</th>
                <th className="text-left px-3 py-2">Flags</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {indexes.map((idx) => (
                <tr key={idx.indexName} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs max-w-[180px] truncate" title={idx.indexName}>
                    {idx.indexName}
                  </td>
                  <td className="px-3 py-2 text-xs">{idx.tableName}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground max-w-[160px] truncate" title={idx.columns}>
                    {idx.columns || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs bg-muted border rounded px-1.5 py-0.5 font-mono">
                      {idx.indexType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums">{idx.indexSize}</td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums">{idx.idxScan.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums">{idx.idxTupRead.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums">{idx.idxTupFetch.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {isUnused(idx) && <UnusedBadge />}
                      {idx.isPrimary && (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 font-medium">
                          PK
                        </span>
                      )}
                      {idx.isUnique && !idx.isPrimary && (
                        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5 font-medium">
                          Unique
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!idx.isPrimary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-7 px-2 text-xs"
                        onClick={() => handleDrop(idx.indexName)}
                      >
                        Drop
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create index modal */}
      {showCreate && (
        <CreateIndexModal
          workspaceId={workspaceId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchIndexes();
          }}
        />
      )}
    </div>
  );
}
