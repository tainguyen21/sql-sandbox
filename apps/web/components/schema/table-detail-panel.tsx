'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Column {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
}

interface TableDetail {
  tableName: string;
  columns: Column[];
  indexes: { indexName: string; indexDef: string }[];
  rowCountEstimate: number;
}

interface Props {
  workspaceId: string;
  tableName: string | null;
}

export function TableDetailPanel({ workspaceId, tableName }: Props) {
  const [detail, setDetail] = useState<TableDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tableName) {
      setDetail(null);
      return;
    }
    setLoading(true);
    api
      .getTableDetail(workspaceId, tableName)
      .then(setDetail)
      .catch((err) => console.error('Failed to fetch table detail:', err))
      .finally(() => setLoading(false));
  }, [workspaceId, tableName]);

  if (!tableName) {
    return <div className="text-sm text-muted-foreground p-4">Select a table to view details.</div>;
  }

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;
  if (!detail) return null;

  return (
    <div className="border rounded-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{detail.tableName}</h3>
        <span className="text-xs text-muted-foreground">~{detail.rowCountEstimate} rows</span>
      </div>

      {/* Columns */}
      <div>
        <h4 className="text-sm font-medium mb-2">Columns</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1 pr-4">Name</th>
              <th className="py-1 pr-4">Type</th>
              <th className="py-1 pr-4">Nullable</th>
              <th className="py-1 pr-4">Default</th>
              <th className="py-1">Constraints</th>
            </tr>
          </thead>
          <tbody>
            {detail.columns.map((col) => (
              <tr key={col.columnName} className="border-b border-border/50">
                <td className="py-1 pr-4 font-mono">{col.columnName}</td>
                <td className="py-1 pr-4 font-mono text-muted-foreground">{col.dataType}</td>
                <td className="py-1 pr-4">{col.isNullable ? 'YES' : 'NO'}</td>
                <td className="py-1 pr-4 font-mono text-xs">{col.columnDefault || '-'}</td>
                <td className="py-1">
                  {col.isPrimaryKey && <span className="text-xs bg-primary/10 text-primary px-1 rounded mr-1">PK</span>}
                  {col.isUnique && <span className="text-xs bg-accent px-1 rounded">UQ</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Indexes */}
      {detail.indexes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Indexes</h4>
          <ul className="space-y-1">
            {detail.indexes.map((idx) => (
              <li key={idx.indexName} className="text-xs font-mono bg-muted p-2 rounded">
                {idx.indexDef}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
