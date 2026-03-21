'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Props {
  workspaceId: string;
  onSelectTable: (table: string) => void;
  refreshKey?: number;
}

export function TableListPanel({ workspaceId, onSelectTable, refreshKey }: Props) {
  const [tables, setTables] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const data = await api.getTables(workspaceId);
      setTables(data);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [workspaceId, refreshKey]);

  const handleDrop = async (table: string) => {
    if (!confirm(`Drop table "${table}"? This cannot be undone.`)) return;
    try {
      await api.dropTable(workspaceId, table);
      fetchTables();
      if (selected === table) setSelected(null);
    } catch (err: any) {
      alert(err.message || 'Failed to drop table');
    }
  };

  return (
    <div className="border rounded-md p-3">
      <h3 className="text-sm font-semibold mb-2">Tables</h3>
      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!loading && tables.length === 0 && (
        <p className="text-sm text-muted-foreground">No tables yet. Use the SQL editor to create one.</p>
      )}
      <ul className="space-y-1">
        {tables.map((t) => (
          <li key={t} className="flex items-center justify-between group">
            <button
              onClick={() => {
                setSelected(t);
                onSelectTable(t);
              }}
              className={`text-sm px-2 py-1 rounded flex-1 text-left transition-colors ${
                selected === t ? 'bg-accent font-medium' : 'hover:bg-accent/50'
              }`}
            >
              {t}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 text-destructive h-7 px-2"
              onClick={() => handleDrop(t)}
            >
              Drop
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
